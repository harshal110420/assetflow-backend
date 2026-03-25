// models/Employee.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// ─── Employee ─────────────────────────────────────────────────────────────────
const Employee = sequelize.define(
  "Employee",
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

    firstName: { type: DataTypes.STRING(100), allowNull: false },
    lastName: { type: DataTypes.STRING(100), allowNull: false },

    // email unique per tenant
    email: { type: DataTypes.STRING(255), allowNull: false },

    phone: { type: DataTypes.STRING(20) },
    avatar: { type: DataTypes.STRING(500) },

    // employeeCode unique per tenant
    employeeCode: { type: DataTypes.STRING(50) },

    designation: { type: DataTypes.STRING(100) },
    employmentType: {
      type: DataTypes.ENUM("Full-time", "Part-time", "Contract", "Intern"),
      defaultValue: "Full-time",
    },
    departmentId: { type: DataTypes.UUID, allowNull: true },
    locationId: { type: DataTypes.UUID, allowNull: true },
    reportingManagerId: { type: DataTypes.UUID, allowNull: true },
    joiningDate: { type: DataTypes.DATEONLY },
    leavingDate: { type: DataTypes.DATEONLY },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    userId: { type: DataTypes.UUID, allowNull: true },
  },
  {
    tableName: "employees",
    indexes: [
      {
        unique: true,
        fields: ["email", "tenantId"],
        name: "employees_email_tenant_unique",
      },
      {
        unique: true,
        fields: ["employeeCode", "tenantId"],
        name: "employees_code_tenant_unique",
      },
      { fields: ["tenantId"] },
    ],
  },
);

module.exports = Employee;
