const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const bcrypt = require("bcryptjs");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // ── Tenant ─────────────────────────────────────────────────────────────
    tenantId: {
      type: DataTypes.UUID,
      allowNull: false, // har user kisi na kisi company ka hoga
      references: { model: "tenants", key: "id" },
    },

    firstName: { type: DataTypes.STRING(100), allowNull: false },
    lastName: { type: DataTypes.STRING(100), allowNull: false },

    // email unique per tenant — do alag companies mein same email allowed
    email: { type: DataTypes.STRING(255), allowNull: false },

    password: { type: DataTypes.STRING(255), allowNull: false },
    role: { type: DataTypes.STRING(100), defaultValue: "viewer" },
    departmentId: { type: DataTypes.UUID, allowNull: true },
    phone: { type: DataTypes.STRING(20) },
    avatar: { type: DataTypes.STRING(500) },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    lastLogin: { type: DataTypes.DATE },
    reportingManagerId: { type: DataTypes.UUID, allowNull: true },
    roleId: { type: DataTypes.UUID, allowNull: true },
    customPermissions: { type: DataTypes.JSON, defaultValue: null },
    notificationPreferences: {
      type: DataTypes.JSON,
      defaultValue: {
        emailOnApprovalRequest: true,
        emailOnApprovalAction: true,
        emailOnAssetAssigned: true,
        emailOnMaintenanceDue: true,
      },
    },
  },
  {
    tableName: "users",
    // ── email unique per tenant (not globally) ─────────────────────────────
    indexes: [
      {
        unique: true,
        fields: ["email", "tenantId"], // same email allowed in different companies
        name: "users_email_tenant_unique",
      },
    ],
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) user.password = await bcrypt.hash(user.password, 12);
      },
      beforeUpdate: async (user) => {
        if (user.changed("password"))
          user.password = await bcrypt.hash(user.password, 12);
      },
    },
  },
);

User.prototype.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password;
  return values;
};

module.exports = User;
