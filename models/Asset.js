const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Asset = sequelize.define(
  "Asset",
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

    // assetTag unique per tenant
    assetTag: { type: DataTypes.STRING(50), allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT },

    // ── Category — FK replace ENUM ─────────────────────────────────────────
    // ENUM hata diya — ab Category table se aayega (dynamic)
    categoryId: {
      type: DataTypes.UUID,
      allowNull: true, // null allowed — migration ke liye
      references: { model: "categories", key: "id" },
    },
    subCategoryId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "sub_categories", key: "id" },
    },

    // ── Asset Details ───────────────────────────────────────────────────────
    brandId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    vendorId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    model: { type: DataTypes.STRING(100) },
    serialNumber: { type: DataTypes.STRING(200) },

    status: {
      type: DataTypes.ENUM(
        "Active",
        "Inactive",
        "In Maintenance",
        "Disposed",
        "Lost",
        "Reserved",
      ),
      defaultValue: "Active",
    },
    condition: {
      type: DataTypes.ENUM("Excellent", "Good", "Fair", "Poor", "Damaged"),
      defaultValue: "Good",
    },

    // ── Location ───────────────────────────────────────────────────────────
    location: { type: DataTypes.STRING(255) }, // legacy text field
    locationId: { type: DataTypes.UUID, allowNull: true },

    // ── Department ─────────────────────────────────────────────────────────
    departmentId: { type: DataTypes.UUID, allowNull: true },

    // ── Financial ──────────────────────────────────────────────────────────
    purchaseDate: { type: DataTypes.DATEONLY },
    purchasePrice: { type: DataTypes.DECIMAL(15, 2) },
    currentValue: { type: DataTypes.DECIMAL(15, 2) },
    warrantyExpiry: { type: DataTypes.DATEONLY },
    depreciationRate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 20.0 },
    invoiceNumber: { type: DataTypes.STRING(100) },

    // ── Assignment ─────────────────────────────────────────────────────────
    assignmentType: {
      type: DataTypes.ENUM("employee", "department", "location", "pool"),
      defaultValue: "pool",
      allowNull: false,
    },
    assignedToId: { type: DataTypes.UUID, allowNull: true },
    assignedToDeptId: { type: DataTypes.UUID, allowNull: true },
    assignedToLocId: { type: DataTypes.UUID, allowNull: true },

    // ── Meta ───────────────────────────────────────────────────────────────
    createdById: { type: DataTypes.UUID },
    lastAuditDate: { type: DataTypes.DATEONLY },
    nextAuditDate: { type: DataTypes.DATEONLY },
    maintenanceSchedule: { type: DataTypes.JSON },
    notes: { type: DataTypes.TEXT },
    imageUrl: { type: DataTypes.STRING(500) },
    qrCode: { type: DataTypes.TEXT },
    customFields: { type: DataTypes.JSON },
    tags: { type: DataTypes.JSON },
  },
  {
    tableName: "assets",
    indexes: [
      {
        unique: true,
        fields: ["assetTag", "tenantId"],
        name: "assets_tag_tenant_unique",
      },
      { fields: ["tenantId"] },
      { fields: ["categoryId"] }, // ← was "category" ENUM index
      { fields: ["subCategoryId"] }, // ← new
      { fields: ["status"] },
      { fields: ["assignmentType"] },
      { fields: ["assignedToId"] },
      { fields: ["assignedToDeptId"] },
      { fields: ["assignedToLocId"] },
      { fields: ["locationId"] },
      { fields: ["departmentId"] },
    ],
  },
);

module.exports = Asset;
