// models/Division.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Division = sequelize.define(
  "Division",
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

    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    code: { type: DataTypes.STRING(20), unique: true }, // e.g. ICE, SNK, BAK, DAI
    description: { type: DataTypes.TEXT },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    tableName: "divisions",
    indexes: [
      {
        unique: true,
        fields: ["code", "tenantId"],
        name: "divisions_code_tenant_unique",
      },
      {
        unique: true,
        fields: ["name", "tenantId"],
        name: "divisions_name_tenant_unique",
      },
      { fields: ["tenantId"] },
    ],
  },
);

module.exports = Division;
