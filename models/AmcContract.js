// models/AmcContract.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const AmcContract = sequelize.define(
  "AmcContract",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    contractNumber: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    vendorName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    vendorContact: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    vendorEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: { isEmail: true },
    },
    contractType: {
      type: DataTypes.ENUM("AMC", "CMC"),
      defaultValue: "AMC",
    },
    coverageType: {
      type: DataTypes.ENUM(
        "Labor Only",
        "Parts + Labor",
        "On-site",
        "Off-site",
      ),
      defaultValue: "Parts + Labor",
    },
    serviceFrequency: {
      type: DataTypes.ENUM(
        "Monthly",
        "Quarterly",
        "Half-Yearly",
        "Yearly",
        "On-Demand",
      ),
      defaultValue: "Yearly",
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    contractCost: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM("Active", "Expired", "Pending Renewal", "Cancelled"),
      defaultValue: "Active",
    },
    documentUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    tableName: "amc_contracts",
    timestamps: true,
    // contractNumber tenant ke andar unique hona chahiye
    indexes: [
      {
        unique: true,
        fields: ["tenantId", "contractNumber"],
      },
    ],
  },
);

module.exports = AmcContract;
