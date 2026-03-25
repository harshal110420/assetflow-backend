const { AuditLog } = require("../models");
const Setting = require("../models/Setting");
const nodemailer = require("nodemailer");

// ── Helper: parse value by type ───────────────────────────────────────────────
const parseValue = (value, type) => {
  if (value === null || value === undefined) return null;
  switch (type) {
    case "boolean":
      return value === "true" || value === true;
    case "number":
      return parseFloat(value);
    case "json":
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      return value;
  }
};

// ── Helper: format settings as object ────────────────────────────────────────
const formatSettings = (settings) => {
  const result = {};
  settings.forEach((s) => {
    result[s.key] = {
      value: parseValue(s.value, s.type),
      rawValue: s.value,
      type: s.type,
      label: s.label,
      description: s.description,
      category: s.category,
    };
  });
  return result;
};

// ── GET ALL SETTINGS ──────────────────────────────────────────────────────────
exports.getSettings = async (req, res) => {
  try {
    const settings = await Setting.findAll({
      where: { tenantId: req.user.tenantId }, // ← ADD
      order: [
        ["category", "ASC"],
        ["key", "ASC"],
      ],
    });
    res.json({ success: true, data: formatSettings(settings) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET SETTINGS BY CATEGORY ──────────────────────────────────────────────────
exports.getSettingsByCategory = async (req, res) => {
  try {
    const settings = await Setting.findAll({
      where: { category: req.params.category, tenantId: req.user.tenantId }, // ← ADD tenantId
      order: [["key", "ASC"]],
    });
    res.json({ success: true, data: formatSettings(settings) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── UPDATE SETTINGS (bulk) ────────────────────────────────────────────────────
exports.updateSettings = async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== "object")
      return res
        .status(400)
        .json({ success: false, message: "Settings object required" });

    const updates = [];
    for (const [key, value] of Object.entries(settings)) {
      // Sirf usi tenant ki setting update karo
      const setting = await Setting.findOne({
        where: { key, tenantId: req.user.tenantId }, // ← ADD tenantId
      });
      if (setting) {
        const strValue =
          typeof value === "object" ? JSON.stringify(value) : String(value);
        await setting.update({ value: strValue });
        updates.push(key);
      }
    }

    // Email config reload — sirf usi tenant ka
    if (updates.some((k) => k.startsWith("email."))) {
      await reloadEmailConfig(req.user.tenantId); // ← ADD tenantId
    }
    // res.json se pehle add karo:
    await AuditLog.create({
      entityType: "Setting",
      entityId: req.user.tenantId,
      tenantId: req.user.tenantId,
      action: "UPDATE",
      userId: req.user.id,
      newValues: { updatedKeys: updates },
      description: `Settings updated: ${updates.join(", ")}`,
    });
    res.json({
      success: true,
      message: `${updates.length} settings updated`,
      updated: updates,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET SINGLE SETTING ────────────────────────────────────────────────────────
exports.getSetting = async (req, res) => {
  try {
    const setting = await Setting.findOne({
      where: { key: req.params.key, tenantId: req.user.tenantId }, // ← ADD tenantId
    });
    if (!setting)
      return res
        .status(404)
        .json({ success: false, message: "Setting not found" });

    res.json({
      success: true,
      data: {
        value: parseValue(setting.value, setting.type),
        rawValue: setting.value,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── TEST EMAIL ────────────────────────────────────────────────────────────────
exports.testEmail = async (req, res) => {
  try {
    const { to } = req.body;
    if (!to)
      return res
        .status(400)
        .json({ success: false, message: "Recipient email required" });

    // Sirf usi tenant ki email settings use karo
    const emailSettings = await Setting.findAll({
      where: { category: "email", tenantId: req.user.tenantId }, // ← ADD tenantId
    });
    const config = {};
    emailSettings.forEach((s) => {
      config[s.key.replace("email.", "")] = s.value;
    });

    if (!config.host)
      return res
        .status(400)
        .json({ success: false, message: "SMTP Host not configured" });

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: parseInt(config.port) || 587,
      secure: config.secure === "true",
      auth: { user: config.user, pass: config.pass },
    });

    await transporter.sendMail({
      from: `"${config.fromName || "AssetFlow"}" <${config.fromEmail || config.user}>`,
      to,
      subject: "AssetFlow — Test Email",
      html: `<p>This is a test email from <b>AssetFlow AMS</b>.</p><p>Your email configuration is working correctly!</p>`,
    });

    res.json({ success: true, message: `Test email sent to ${to}` });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: `Email failed: ${err.message}` });
  }
};

// ── Helper: Reload email config — tenantId parameter add kiya ────────────────
// Note: process.env reload multi-tenant mein kaam nahi karega properly
// Better approach: emailService ko har request pe DB se config lo
async function reloadEmailConfig(tenantId) {
  try {
    const emailSettings = await Setting.findAll({
      where: { category: "email", tenantId }, // ← ADD tenantId
    });
    const config = {};
    emailSettings.forEach((s) => {
      config[s.key.replace("email.", "")] = s.value;
    });
    // process.env update — single tenant ke liye kaam karta hai
    // Multi-tenant mein ye ek tenant ki settings overwrite kar sakta hai
    // TODO: emailService mein tenantId-based dynamic config implement karo
    if (config.host) process.env.SMTP_HOST = config.host;
    if (config.port) process.env.SMTP_PORT = config.port;
    if (config.secure) process.env.SMTP_SECURE = config.secure;
    if (config.user) process.env.SMTP_USER = config.user;
    if (config.pass) process.env.SMTP_PASS = config.pass;
    if (config.fromName) process.env.SMTP_FROM_NAME = config.fromName;
    if (config.fromEmail) process.env.SMTP_FROM_EMAIL = config.fromEmail;
  } catch (err) {
    console.error("[SETTINGS] Email config reload failed:", err.message);
  }
}

// ── Public helper: get setting value by key (tenantId required) ──────────────
exports.getSettingValue = async (key, tenantId, defaultValue = null) => {
  // ← ADD tenantId param
  try {
    const setting = await Setting.findOne({
      where: { key, tenantId }, // ← ADD tenantId
    });
    if (!setting) return defaultValue;
    return parseValue(setting.value, setting.type);
  } catch {
    return defaultValue;
  }
};

exports.reloadEmailConfig = reloadEmailConfig;
