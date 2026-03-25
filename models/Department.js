// models/Department.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Department = sequelize.define(
  "Department",
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

    name: { type: DataTypes.STRING(100), allowNull: false },
    code: { type: DataTypes.STRING(20) }, // e.g. SALES, PROD, QC
    description: { type: DataTypes.TEXT },
    divisionId: { type: DataTypes.UUID, allowNull: false }, // FK to Division
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  { tableName: "departments", indexes: [{ fields: ["tenantId"] }] },
);

module.exports = Department;
