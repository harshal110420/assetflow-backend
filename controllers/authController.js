const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { AuditLog } = require("../models/index");

// ── tenantId bhi token mein hai ───────────────────────────────────────────────
const generateToken = (id, tenantId) =>
  jwt.sign({ id, tenantId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "1d",
  });

// ─── REGISTER ────────────────────────────────────────────────────────────────
// Note: Register directly nahi hona chahiye multi-tenant mein —
// naye users sirf existing tenant ke admin create karein.
// Agar public register chahiye toh tenantId body se lena hoga.
// Abhi ke liye existing logic same rakha hai.
exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, department, phone } =
      req.body;

    // Email unique per tenant — agar tenantId body mein hai toh use karo
    const tenantId = req.body.tenantId;
    const whereClause = tenantId ? { email, tenantId } : { email };

    const existing = await User.findOne({ where: whereClause }); // ← FIX: tenant aware check
    if (existing)
      return res
        .status(400)
        .json({ success: false, message: "Email already registered" });

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role,
      department,
      phone,
      tenantId, // ← ADD: tenantId inject karo
    });

    await AuditLog.create({
      entityType: "User",
      entityId: user.id,
      tenantId: user.tenantId, // ← ADD
      action: "REGISTER",
      userId: user.id,
      description: `User ${email} registered`,
    });

    res.status(201).json({
      success: true,
      token: generateToken(user.id, user.tenantId),
      user,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ success: false, message: "Provide email and password" });

    // Email globally unique nahi hai anymore — tenant ke saath dhundho
    // Agar ek hi email multiple tenants mein ho to problem hogi
    // Solution: login mein subdomain/tenantId bhi lo (future enhancement)
    // Abhi ke liye: pehla matching active user lo
    const user = await User.findOne({
      where: { email, isActive: true }, // isActive filter add kiya
    });

    if (!user || !(await user.comparePassword(password))) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    // isActive check already where clause mein hai — ye redundant hai but safe
    if (!user.isActive)
      return res
        .status(401)
        .json({ success: false, message: "Account deactivated" });

    await user.update({ lastLogin: new Date() });

    await AuditLog.create({
      entityType: "User",
      entityId: user.id,
      tenantId: user.tenantId, // ← ADD
      action: "LOGIN",
      userId: user.id,
      ipAddress: req.ip,
      description: `User ${email} logged in`,
    });

    res.json({
      success: true,
      token: generateToken(user.id, user.tenantId),
      user,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET ME ───────────────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// ─── UPDATE PROFILE ───────────────────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, department, phone } = req.body;
    const oldValues = {
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      department: req.user.department,
      phone: req.user.phone,
    };

    await req.user.update({ firstName, lastName, department, phone });

    // ── Audit Log ─────────────────────────────────────────────────────────────
    await AuditLog.create({
      entityType: "User",
      entityId: req.user.id,
      tenantId: req.user.tenantId,
      action: "PROFILE_UPDATE",
      userId: req.user.id,
      oldValues,
      newValues: { firstName, lastName, department, phone },
      description: `User ${req.user.email} updated their profile`,
    });

    res.json({ success: true, user: req.user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── CHANGE PASSWORD ──────────────────────────────────────────────────────────
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findOne({
      where: { id: req.user.id, tenantId: req.user.tenantId },
    });

    if (!(await user.comparePassword(currentPassword))) {
      return res
        .status(400)
        .json({ success: false, message: "Current password incorrect" });
    }

    await user.update({ password: newPassword });

    // ── Audit Log ─────────────────────────────────────────────────────────────
    await AuditLog.create({
      entityType: "User",
      entityId: req.user.id,
      tenantId: req.user.tenantId,
      action: "PASSWORD_CHANGE",
      userId: req.user.id,
      ipAddress: req.ip,
      description: `User ${req.user.email} changed their password`,
    });

    res.json({ success: true, message: "Password updated" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
