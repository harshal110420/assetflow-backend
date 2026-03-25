const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// ─── Approval Template ───────────────────────────────────────────────────────
// Admin creates templates like "Asset Assignment Approval", "Disposal Approval"
const ApprovalTemplate = sequelize.define(
  "ApprovalTemplate",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // ── Tenant ───────────────────────────────────────────────────────────────
    tenantId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "tenants", key: "id" },
    },

    name: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT },
    module: {
      type: DataTypes.ENUM(
        "asset_assignment",
        "asset_disposal",
        "asset_purchase",
        "maintenance",
        "asset_transfer",
      ),
      allowNull: false,
    },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    createdById: { type: DataTypes.UUID },
  },
  {
    tableName: "approval_templates",
    indexes: [{ fields: ["tenantId"] }, { fields: ["module"] }],
  },
);

// ─── Approval Template Steps ─────────────────────────────────────────────────
// Each step in the approval chain
// approverType:
//   'specific_user' → fixed person (e.g. always IT Head)
//   'role'          → anyone with that role (e.g. any 'manager')
//   'reporting_manager' → requester ka direct manager (dynamic)
const ApprovalTemplateStep = sequelize.define(
  "ApprovalTemplateStep",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // ── Tenant ───────────────────────────────────────────────────────────────
    tenantId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "tenants", key: "id" },
    },

    templateId: { type: DataTypes.UUID, allowNull: false },
    stepOrder: { type: DataTypes.INTEGER, allowNull: false },
    stepName: { type: DataTypes.STRING(200), allowNull: false },
    approverType: {
      type: DataTypes.ENUM("specific_user", "role", "reporting_manager"),
      allowNull: false,
    },
    // If approverType = 'specific_user' → store userId
    // If approverType = 'role' → store role name e.g. 'manager'
    // If approverType = 'reporting_manager' → null (resolved at runtime)
    approverValue: { type: DataTypes.STRING(100) },

    // Optional condition — skip this step if condition not met
    isConditional: { type: DataTypes.BOOLEAN, defaultValue: false },
    conditionField: { type: DataTypes.STRING(100) }, // e.g. 'currentValue', 'category'
    conditionOperator: {
      type: DataTypes.ENUM(">", "<", "=", ">=", "<=", "!="),
    },
    conditionValue: { type: DataTypes.STRING(200) },

    // If true, workflow continues even if this step is rejected
    isOptional: { type: DataTypes.BOOLEAN, defaultValue: false },

    // Auto-approve after X hours if no action taken (0 = no auto-approve)
    autoApproveHours: { type: DataTypes.INTEGER, defaultValue: 0 },

    remarks: { type: DataTypes.TEXT },
  },
  {
    tableName: "approval_template_steps",
    indexes: [{ fields: ["tenantId"] }, { fields: ["templateId"] }],
  },
);

// ─── Approval Request ─────────────────────────────────────────────────────────
// Created when someone triggers an approval (e.g. assigns an asset)
const ApprovalRequest = sequelize.define(
  "ApprovalRequest",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // ── Tenant ───────────────────────────────────────────────────────────────
    tenantId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "tenants", key: "id" },
    },

    requestNumber: { type: DataTypes.STRING(50), unique: true }, // e.g. APR-2024-0001
    templateId: { type: DataTypes.UUID, allowNull: false },
    module: { type: DataTypes.STRING(100), allowNull: false },
    moduleRecordId: { type: DataTypes.UUID, allowNull: false }, // assetId, maintenanceId etc.
    moduleData: { type: DataTypes.JSON }, // snapshot of data at time of request

    requestedById: { type: DataTypes.UUID, allowNull: false },
    currentStepOrder: { type: DataTypes.INTEGER, defaultValue: 1 },

    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected", "cancelled"),
      defaultValue: "pending",
    },

    // Final approval/rejection details
    finalizedById: { type: DataTypes.UUID },
    finalizedAt: { type: DataTypes.DATE },
    finalRemarks: { type: DataTypes.TEXT },

    // Priority
    priority: {
      type: DataTypes.ENUM("low", "normal", "high", "urgent"),
      defaultValue: "normal",
    },

    dueDate: { type: DataTypes.DATE },
  },
  {
    tableName: "approval_requests",
    indexes: [
      {
        unique: true,
        fields: ["requestNumber", "tenantId"],
        name: "approval_req_number_tenant_unique",
      },
      { fields: ["tenantId"] },
      { fields: ["status"] },
      { fields: ["requestedById"] },
      { fields: ["module", "moduleRecordId"] },
    ],
  },
);

// ─── Approval Request Steps ───────────────────────────────────────────────────
// Instance of each step for a specific request
const ApprovalRequestStep = sequelize.define(
  "ApprovalRequestStep",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // ── Tenant ───────────────────────────────────────────────────────────────
    tenantId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "tenants", key: "id" },
    },

    requestId: { type: DataTypes.UUID, allowNull: false },
    templateStepId: { type: DataTypes.UUID, allowNull: false },
    stepOrder: { type: DataTypes.INTEGER, allowNull: false },
    stepName: { type: DataTypes.STRING(200) },

    // Resolved approver (actual userId, resolved from template step logic)
    assignedToUserId: { type: DataTypes.UUID, allowNull: false },

    status: {
      type: DataTypes.ENUM(
        "pending",
        "approved",
        "rejected",
        "skipped",
        "auto_approved",
      ),
      defaultValue: "pending",
    },

    remarks: { type: DataTypes.TEXT },
    actionAt: { type: DataTypes.DATE },
    notifiedAt: { type: DataTypes.DATE },
    reminderSentAt: { type: DataTypes.DATE },
  },
  {
    tableName: "approval_request_steps",
    indexes: [
      { fields: ["tenantId"] },
      { fields: ["requestId"] },
      { fields: ["assignedToUserId", "status"] },
    ],
  },
);

module.exports = {
  ApprovalTemplate,
  ApprovalTemplateStep,
  ApprovalRequest,
  ApprovalRequestStep,
};
