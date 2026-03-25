const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Key-Value settings store
const Setting = sequelize.define(
  "Setting",
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

    key: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    value: { type: DataTypes.TEXT },
    type: {
      type: DataTypes.ENUM("string", "number", "boolean", "json"),
      defaultValue: "string",
    },
    category: { type: DataTypes.STRING(50) }, // company, email, security, asset, approval, notification
    label: { type: DataTypes.STRING(200) },
    description: { type: DataTypes.TEXT },
  },
  {
    tableName: "settings",
    indexes: [
      // key + tenantId unique — same key different tenant allowed
      {
        unique: true,
        fields: ["key", "tenantId"],
        name: "settings_key_tenant_unique",
      },
      { fields: ["tenantId"] },
      { fields: ["category"] },
    ],
  },
);

module.exports = Setting;
