const Setting = require("../models/Setting");

const DEFAULT_SETTINGS = [
  // ── Company ──────────────────────────────────────────────────────────────────
  {
    key: "company.name",
    value: "AssetFlow AMS",
    type: "string",
    category: "company",
    label: "Company Name",
  },
  {
    key: "company.email",
    value: "",
    type: "string",
    category: "company",
    label: "Company Email",
  },
  {
    key: "company.phone",
    value: "",
    type: "string",
    category: "company",
    label: "Company Phone",
  },
  {
    key: "company.address",
    value: "",
    type: "string",
    category: "company",
    label: "Company Address",
  },
  {
    key: "company.timezone",
    value: "Asia/Kolkata",
    type: "string",
    category: "company",
    label: "Timezone",
  },
  {
    key: "company.currency",
    value: "INR",
    type: "string",
    category: "company",
    label: "Currency",
  },
  {
    key: "company.dateFormat",
    value: "DD/MM/YYYY",
    type: "string",
    category: "company",
    label: "Date Format",
  },

  // ── Email / SMTP ──────────────────────────────────────────────────────────────
  {
    key: "email.host",
    value: "",
    type: "string",
    category: "email",
    label: "SMTP Host",
  },
  {
    key: "email.port",
    value: "587",
    type: "number",
    category: "email",
    label: "SMTP Port",
  },
  {
    key: "email.secure",
    value: "false",
    type: "boolean",
    category: "email",
    label: "Use SSL/TLS",
  },
  {
    key: "email.user",
    value: "",
    type: "string",
    category: "email",
    label: "SMTP Username",
  },
  {
    key: "email.pass",
    value: "",
    type: "string",
    category: "email",
    label: "SMTP Password",
  },
  {
    key: "email.fromName",
    value: "AssetFlow AMS",
    type: "string",
    category: "email",
    label: "From Name",
  },
  {
    key: "email.fromEmail",
    value: "",
    type: "string",
    category: "email",
    label: "From Email",
  },
  {
    key: "email.enabled",
    value: "true",
    type: "boolean",
    category: "email",
    label: "Enable Email Notifications",
  },

  // ── Security / Bypass ─────────────────────────────────────────────────────────
  {
    key: "security.adminRole",
    value: "admin",
    type: "string",
    category: "security",
    label: "Admin Role Slug",
    description: "This role bypasses all permission checks",
  },
  {
    key: "security.bypassRoles",
    value: '["admin"]',
    type: "json",
    category: "security",
    label: "Permission Bypass Roles",
    description: "These roles skip permission checks",
  },
  {
    key: "security.approvalBypassRoles",
    value: '["admin"]',
    type: "json",
    category: "security",
    label: "Approval Bypass Roles",
    description: "These roles can approve their own requests",
  },

  // ── Asset Rules ───────────────────────────────────────────────────────────────
  {
    key: "asset.tagPrefix",
    value: "AST",
    type: "string",
    category: "asset",
    label: "Asset Tag Prefix",
    description: "e.g. AST → AST-001-MBP",
  },
  {
    key: "asset.defaultDepreciation",
    value: "20",
    type: "number",
    category: "asset",
    label: "Default Depreciation Rate (%)",
    description: "Annual depreciation rate",
  },
  {
    key: "asset.warrantyAlertDays",
    value: "30",
    type: "number",
    category: "asset",
    label: "Warranty Alert Days",
    description: "Alert X days before warranty expires",
  },
  {
    key: "asset.maintenanceAlertDays",
    value: "7",
    type: "number",
    category: "asset",
    label: "Maintenance Due Alert Days",
  },
  {
    key: "asset.autoTagEnabled",
    value: "true",
    type: "boolean",
    category: "asset",
    label: "Auto-generate Asset Tags",
  },

  // ── Approval Rules ────────────────────────────────────────────────────────────
  {
    key: "approval.valueThreshold",
    value: "10000",
    type: "number",
    category: "approval",
    label: "Value Threshold for Approval (₹)",
    description: "Assets above this value require approval",
  },
  {
    key: "approval.autoApproveHours",
    value: "48",
    type: "number",
    category: "approval",
    label: "Auto-approve Timeout (hours)",
    description: "0 = disabled",
  },
  {
    key: "approval.allowSelfApprove",
    value: "false",
    type: "boolean",
    category: "approval",
    label: "Allow Self-approval",
    description: "Can a user approve their own requests?",
  },

  // ── Notifications ─────────────────────────────────────────────────────────────
  {
    key: "notification.warrantyReminder",
    value: "true",
    type: "boolean",
    category: "notification",
    label: "Warranty Expiry Reminders",
  },
  {
    key: "notification.maintenanceReminder",
    value: "true",
    type: "boolean",
    category: "notification",
    label: "Maintenance Due Reminders",
  },
  {
    key: "notification.assignmentAlert",
    value: "true",
    type: "boolean",
    category: "notification",
    label: "Asset Assignment Alerts",
  },
  {
    key: "notification.approvalAlert",
    value: "true",
    type: "boolean",
    category: "notification",
    label: "Approval Request Alerts",
  },
];

async function seedSettings() {
  console.log("🌱 Seeding default settings...");
  for (const setting of DEFAULT_SETTINGS) {
    await Setting.findOrCreate({
      where: { key: setting.key },
      defaults: setting,
    });
  }
  console.log("✅ Settings seeded");
}

module.exports = seedSettings;
