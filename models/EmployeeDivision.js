// models/EmployeeDivision.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const EmployeeDivision = sequelize.define(
  "EmployeeDivision",
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

    employeeId: { type: DataTypes.UUID, allowNull: false },
    divisionId: { type: DataTypes.UUID, allowNull: false },
    isPrimary: { type: DataTypes.BOOLEAN, defaultValue: false }, // primary division kon si hai
  },
  {
    tableName: "employee_divisions",
    indexes: [{ fields: ["tenantId"] }],
  },
);

module.exports = EmployeeDivision;
