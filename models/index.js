const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Maintenance = sequelize.define(
  "Maintenance",
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

    assetId: { type: DataTypes.UUID, allowNull: false },
    type: {
      type: DataTypes.ENUM(
        "Preventive",
        "Corrective",
        "Predictive",
        "Emergency",
        "Inspection",
      ),
      allowNull: false,
    },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT },
    status: {
      type: DataTypes.ENUM(
        "Scheduled",
        "In Progress",
        "Completed",
        "Cancelled",
        "Overdue",
      ),
      defaultValue: "Scheduled",
    },
    priority: {
      type: DataTypes.ENUM("Low", "Medium", "High", "Critical"),
      defaultValue: "Medium",
    },
    scheduledDate: { type: DataTypes.DATEONLY },
    completedDate: { type: DataTypes.DATEONLY },
    cost: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    technicianId: { type: DataTypes.UUID },
    vendor: { type: DataTypes.STRING(255) },
    notes: { type: DataTypes.TEXT },
    attachments: { type: DataTypes.JSON },
  },
  {
    tableName: "maintenances",
    indexes: [{ fields: ["tenantId"] }, { fields: ["assetId"] }],
  },
);

const Assignment = sequelize.define(
  "Assignment",
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

    assetId: { type: DataTypes.UUID, allowNull: false },

    // ── Assignment Type — Single Custody Model ────────────────────────────────
    assignmentType: {
      type: DataTypes.ENUM("employee", "department", "location", "pool"),
      allowNull: false,
      defaultValue: "employee",
    },

    // Sirf ek active hogi at a time based on assignmentType
    employeeId: { type: DataTypes.UUID, allowNull: true }, // → Employee
    departmentId: { type: DataTypes.UUID, allowNull: true }, // → Department
    locationId: { type: DataTypes.UUID, allowNull: true }, // → Location (branch)

    // ── Meta ──────────────────────────────────────────────────────────────────
    assignedById: { type: DataTypes.UUID }, // → User (system user)
    assignedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    returnedAt: { type: DataTypes.DATE },
    purpose: { type: DataTypes.STRING(500) },
    notes: { type: DataTypes.TEXT },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    conditionAtAssignment: {
      type: DataTypes.ENUM("Excellent", "Good", "Fair", "Poor", "Damaged"),
    },
    conditionAtReturn: {
      type: DataTypes.ENUM("Excellent", "Good", "Fair", "Poor", "Damaged"),
    },
    configSnapshot: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
      comment: "Asset customFields snapshot at time of assignment",
    },
  },
  { tableName: "assignments" },
);

const AuditLog = sequelize.define(
  "AuditLog",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // ── Tenant ───────────────────────────────────────────────────────────────
    tenantId: {
      type: DataTypes.UUID,
      allowNull: true, // allowNull:true — system-level logs ke liye
      references: { model: "tenants", key: "id" },
    },

    entityType: { type: DataTypes.STRING(50), allowNull: false },
    entityId: { type: DataTypes.STRING(100), allowNull: false },
    action: { type: DataTypes.STRING(100), allowNull: false },
    oldValues: { type: DataTypes.JSON },
    newValues: { type: DataTypes.JSON },
    userId: { type: DataTypes.UUID },
    ipAddress: { type: DataTypes.STRING(45) },
    userAgent: { type: DataTypes.STRING(500) },
    description: { type: DataTypes.TEXT },
  },
  {
    tableName: "audit_logs",
    updatedAt: false,
    indexes: [{ fields: ["tenantId"] }, { fields: ["entityType", "entityId"] }],
  },
);

// ─── Category ─────────────────────────────────────────────────────────────────

const Category = sequelize.define(
  "Category",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // ── Tenant ─────────────────────────────────────────────────────────────
    tenantId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "tenants", key: "id" },
    },

    name: {
      type: DataTypes.STRING(100),
      allowNull: false, // "Hardware", "Software", "Custom Category"
    },

    description: { type: DataTypes.TEXT },
    icon: { type: DataTypes.STRING(100) }, // lucide icon name
    color: { type: DataTypes.STRING(20) }, // "#3b82f6"

    depreciationRate: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 20.0, // Annual depreciation %
    },

    usefulLife: {
      type: DataTypes.INTEGER, // Years
    },

    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    tableName: "categories",
    indexes: [
      { fields: ["tenantId"] },
      // name unique per tenant
      {
        unique: true,
        fields: ["name", "tenantId"],
        name: "categories_name_tenant_unique",
      },
    ],
  },
);

// ─── SubCategory ──────────────────────────────────────────────────────────────
const SubCategory = sequelize.define(
  "SubCategory",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // ── Tenant ─────────────────────────────────────────────────────────────
    tenantId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "tenants", key: "id" },
    },

    // Parent Category
    categoryId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "categories", key: "id" },
    },

    name: {
      type: DataTypes.STRING(100),
      allowNull: false, // "Laptop", "Desktop", "Server"
    },

    description: { type: DataTypes.TEXT },
    icon: { type: DataTypes.STRING(100) },
    color: { type: DataTypes.STRING(20) },

    // Override parent category rates if set
    depreciationRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true, // null = use parent category rate
    },
    usefulLife: {
      type: DataTypes.INTEGER,
      allowNull: true, // null = use parent category useful life
    },

    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    tableName: "sub_categories",
    indexes: [
      { fields: ["tenantId"] },
      { fields: ["categoryId"] },
      {
        unique: true,
        fields: ["name", "categoryId", "tenantId"],
        name: "subcategory_name_category_tenant_unique",
      },
    ],
  },
);

module.exports = { Maintenance, Assignment, AuditLog, Category, SubCategory };
