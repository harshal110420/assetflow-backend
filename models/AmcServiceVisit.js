// models/AmcServiceVisit.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const AmcServiceVisit = sequelize.define(
  "AmcServiceVisit",
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
    contractId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    assetId: {
      type: DataTypes.UUID,
      allowNull: true, // null = sabhi covered assets ke liye visit
    },
    visitDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    engineerName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    serviceType: {
      type: DataTypes.ENUM(
        "Preventive Maintenance",
        "Corrective Maintenance",
        "Installation",
        "Inspection",
        "Other",
      ),
      defaultValue: "Preventive Maintenance",
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    partsChanged: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cost: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0, // 0 = AMC mein covered, free
    },
    nextDueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    attachmentUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    tableName: "amc_service_visits",
    timestamps: true,
  },
);

module.exports = AmcServiceVisit;
