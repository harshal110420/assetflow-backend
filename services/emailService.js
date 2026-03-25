const nodemailer = require("nodemailer");
const Setting = require("../models/Setting");

// ─────────────────────────────────────────────────────────────────────────────
// Tenant-aware config — email + company settings ek saath fetch karo
// Multi-tenant mein process.env use nahi kar sakte — ek tenant ki settings
// doosre tenant ko overwrite kar sakti thi
// ─────────────────────────────────────────────────────────────────────────────
const isNotificationEnabled = async (tenantId, settingKey) => {
  try {
    const setting = await Setting.findOne({
      where: { tenantId, key: settingKey },
    });
    if (!setting) return true; // default — agar setting nahi hai toh enabled maano
    return setting.value === "true";
  } catch {
    return true; // error pe bhi enabled maano
  }
};

const getTenantConfig = async (tenantId) => {
  try {
    const settings = await Setting.findAll({
      where: {
        tenantId,
        category: ["email", "company"], // ← dono ek query mein
      },
      attributes: ["key", "value", "category"],
    });

    const email = {};
    const company = {};

    settings.forEach((s) => {
      if (s.category === "email") email[s.key.replace("email.", "")] = s.value;
      if (s.category === "company")
        company[s.key.replace("company.", "")] = s.value;
    });

    return { email, company };
  } catch {
    return { email: {}, company: {} };
  }
};

const createTransporter = (config) => {
  // config se banao, fallback to process.env (single tenant / dev mode)
  return nodemailer.createTransport({
    host: config.host || process.env.SMTP_HOST,
    port: parseInt(config.port || process.env.SMTP_PORT) || 587,
    secure: (config.secure || process.env.SMTP_SECURE) === "true",
    auth: {
      user: config.user || process.env.SMTP_USER,
      pass: config.pass || process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
  });
};

// ─── Base Email Template — companyName dynamic ───────────────────────────────
const baseTemplate = (content, companyName = "AssetFlow") => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #0066cc, #004499); padding: 24px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; }
    .header p { color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px; }
    .body { padding: 28px; }
    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 16px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #64748b; font-weight: 500; }
    .info-value { color: #1e293b; font-weight: 600; }
    .btn { display: inline-block; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; margin: 8px 4px; }
    .btn-approve { background: #10b981; color: #fff; }
    .btn-reject { background: #ef4444; color: #fff; }
    .btn-view { background: #3b82f6; color: #fff; }
    .footer { background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge-pending { background: #fef3c7; color: #d97706; }
    .badge-approved { background: #d1fae5; color: #065f46; }
    .badge-rejected { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚡ ${companyName}</h1>
      <p>Asset Management System</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>This is an automated notification from AssetFlow AMS.</p>
      <p>Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;

// ─── Base Email Sender — tenantId accept karta hai ───────────────────────────
const sendEmail = async ({
  to,
  cc,
  subject,
  html,
  text,
  tenantId,
  attachments,
}) => {
  try {
    // Tenant ka email + company config lo — nahi mila toh env se fallback
    const { email: config } = tenantId
      ? await getTenantConfig(tenantId)
      : { email: {} };

    const host = config.host || process.env.SMTP_HOST;

    if (!host || host === "your_smtp_host") {
      console.log(`[EMAIL SKIPPED] To: ${to} | Subject: ${subject}`);
      return { success: true, skipped: true };
    }

    const transporter = createTransporter(config);
    const fromName =
      config.fromName || process.env.SMTP_FROM_NAME || "AssetFlow";
    const fromEmail =
      config.fromEmail ||
      process.env.SMTP_FROM_EMAIL ||
      config.user ||
      process.env.SMTP_USER;

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      cc: cc || undefined,
      subject,
      html,
      text,
      attachments: attachments || [],
    });

    console.log(`[EMAIL SENT] To: ${to} | MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[EMAIL ERROR] To: ${to} | Error: ${error.message}`);
    return { success: false, error: error.message };
  }
};

// ─── Approval Request Email ───────────────────────────────────────────────────
const sendApprovalRequestEmail = async ({
  approver,
  requester,
  request,
  asset,
  appUrl,
}) => {
  const enabled = await isNotificationEnabled(
    request.tenantId,
    "notification.approvalAlert",
  );
  if (!enabled) {
    console.log(
      `[EMAIL SKIPPED] approvalAlert disabled for tenant ${request.tenantId}`,
    );
    return { success: true, skipped: true };
  }

  // ── Tenant config fetch — Priority: DB → .env → hardcoded ─────────────────
  const { company } = await getTenantConfig(request.tenantId);
  const companyName = company.name || process.env.COMPANY_NAME || "AssetFlow";

  const content = `
    <h2 style="color:#1e293b; margin-top:0;">Approval Required</h2>
    <p>Hello <strong>${approver.firstName}</strong>,</p>
    <p>An approval request is awaiting your action.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Request #</span><span class="info-value">${request.requestNumber}</span></div>
      <div class="info-row"><span class="info-label">Module</span><span class="info-value">${request.module.replace(/_/g, " ").toUpperCase()}</span></div>
      <div class="info-row"><span class="info-label">Asset</span><span class="info-value">${asset?.name || "N/A"} (${asset?.assetTag || ""})</span></div>
      <div class="info-row"><span class="info-label">Requested By</span><span class="info-value">${requester.firstName} ${requester.lastName}</span></div>
      <div class="info-row"><span class="info-label">Date</span><span class="info-value">${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span></div>
      <div class="info-row"><span class="info-label">Status</span><span class="info-value"><span class="badge badge-pending">Pending Your Approval</span></span></div>
    </div>
    <p style="text-align:center; margin-top:24px;">
      <a href="${appUrl}/approvals/${request.id}" class="btn btn-view">View & Take Action</a>
    </p>
    <p style="color:#64748b; font-size:13px;">Please login to AssetFlow to approve or reject this request with your remarks.</p>
  `;

  return sendEmail({
    to: approver.email,
    subject: `[Action Required] Approval Request #${request.requestNumber} — ${request.module.replace(/_/g, " ")}`,
    html: baseTemplate(content, companyName),
    tenantId: request.tenantId,
  });
};

// ─── Approval Action Email (to requester) ────────────────────────────────────
const sendApprovalActionEmail = async ({
  requester,
  approver,
  request,
  asset,
  action,
  remarks,
}) => {
  const enabled = await isNotificationEnabled(
    request.tenantId,
    "notification.approvalAlert",
  );
  if (!enabled) {
    console.log(
      `[EMAIL SKIPPED] approvalAlert disabled for tenant ${request.tenantId}`,
    );
    return { success: true, skipped: true };
  }
  // ── Tenant config fetch — Priority: DB → .env → hardcoded ─────────────────
  const { company } = await getTenantConfig(request.tenantId);
  const companyName = company.name || process.env.COMPANY_NAME || "AssetFlow";

  const isApproved = action === "approved";
  const content = `
    <h2 style="color:#1e293b; margin-top:0;">Request ${isApproved ? "Approved ✅" : "Rejected ❌"}</h2>
    <p>Hello <strong>${requester.firstName}</strong>,</p>
    <p>Your approval request has been <strong style="color:${isApproved ? "#10b981" : "#ef4444"}">${action}</strong>.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Request #</span><span class="info-value">${request.requestNumber}</span></div>
      <div class="info-row"><span class="info-label">Asset</span><span class="info-value">${asset?.name || "N/A"} (${asset?.assetTag || ""})</span></div>
      <div class="info-row"><span class="info-label">Action By</span><span class="info-value">${approver.firstName} ${approver.lastName}</span></div>
      <div class="info-row"><span class="info-label">Status</span><span class="info-value"><span class="badge ${isApproved ? "badge-approved" : "badge-rejected"}">${action.toUpperCase()}</span></span></div>
      ${remarks ? `<div class="info-row"><span class="info-label">Remarks</span><span class="info-value">${remarks}</span></div>` : ""}
    </div>
    <p style="text-align:center; margin-top:24px;">
      <a href="${process.env.FRONTEND_URL}/assets/${asset?.id}" class="btn btn-view">View Asset</a>
    </p>
  `;

  return sendEmail({
    to: requester.email,
    subject: `[${action.toUpperCase()}] Request #${request.requestNumber} has been ${action}`,
    html: baseTemplate(content, companyName),
    tenantId: request.tenantId,
  });
};

// ─── Warranty Expiry Reminder ─────────────────────────────────────────────────
const sendWarrantyExpiryEmail = async ({ recipient, assets, tenantId }) => {
  const enabled = await isNotificationEnabled(
    tenantId,
    "notification.warrantyReminder",
  );
  if (!enabled) return { success: true, skipped: true };

  // ── Tenant config fetch — Priority: DB → .env → hardcoded ─────────────────
  const { company } = await getTenantConfig(tenantId);
  const companyName = company.name || process.env.COMPANY_NAME || "AssetFlow";

  const assetRows = assets
    .map(
      (a) => `
    <div class="info-row">
      <span class="info-label">${a.name} (${a.assetTag})</span>
      <span class="info-value" style="color:#d97706;">${new Date(a.warrantyExpiry).toLocaleDateString("en-IN")}</span>
    </div>`,
    )
    .join("");

  const content = `
    <h2 style="color:#1e293b; margin-top:0;">⚠️ Warranty Expiry Alert</h2>
    <p>Hello <strong>${recipient.firstName}</strong>,</p>
    <p>The following assets have warranties expiring within the next 30 days:</p>
    <div class="info-box">${assetRows}</div>
    <p>Please take necessary action to renew warranties or plan replacements.</p>
    <p style="text-align:center; margin-top:24px;">
      <a href="${process.env.FRONTEND_URL}/assets?filter=warranty_expiring" class="btn btn-view">View Assets</a>
    </p>
  `;

  return sendEmail({
    to: recipient.email,
    subject: `[Alert] ${assets.length} Asset(s) Warranty Expiring Soon`,
    html: baseTemplate(content, companyName),
    tenantId,
  });
};

// ─── Maintenance Due Reminder ─────────────────────────────────────────────────
const sendMaintenanceDueEmail = async ({
  recipient,
  maintenances,
  tenantId,
}) => {
  const enabled = await isNotificationEnabled(
    tenantId,
    "notification.maintenanceReminder",
  );
  if (!enabled) return { success: true, skipped: true };
  // ── Tenant config fetch — Priority: DB → .env → hardcoded ─────────────────
  const { company } = await getTenantConfig(tenantId);
  const companyName = company.name || process.env.COMPANY_NAME || "AssetFlow";

  const rows = maintenances
    .map(
      (m) => `
    <div class="info-row">
      <span class="info-label">${m.title}</span>
      <span class="info-value" style="color:#d97706;">${new Date(m.scheduledDate).toLocaleDateString("en-IN")}</span>
    </div>`,
    )
    .join("");

  const content = `
    <h2 style="color:#1e293b; margin-top:0;">🔧 Maintenance Due Reminder</h2>
    <p>Hello <strong>${recipient.firstName}</strong>,</p>
    <p>The following maintenance tasks are due within the next 7 days:</p>
    <div class="info-box">${rows}</div>
    <p style="text-align:center; margin-top:24px;">
      <a href="${process.env.FRONTEND_URL}/maintenance" class="btn btn-view">View Maintenance</a>
    </p>
  `;

  return sendEmail({
    to: recipient.email,
    subject: `[Reminder] ${maintenances.length} Maintenance Task(s) Due Soon`,
    html: baseTemplate(content, companyName),
    tenantId,
  });
};

module.exports = {
  sendEmail,
  sendApprovalRequestEmail,
  sendApprovalActionEmail,
  sendWarrantyExpiryEmail,
  sendMaintenanceDueEmail,
};
