const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Tenant = sequelize.define(
  "Tenant",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // ── Company Info ───────────────────────────────────────────────────────
    name: {
      type: DataTypes.STRING(200),
      allowNull: false, // "Tata Motors", "Infosys"
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true, // "tata-motors" — URL safe, lowercase
    },
    subdomain: {
      type: DataTypes.STRING(100),
      unique: true, // "tata" → tata.ams.com (future use)
      allowNull: true,
    },

    // ── Contact Info ───────────────────────────────────────────────────────
    email: { type: DataTypes.STRING(255) }, // company contact email
    phone: { type: DataTypes.STRING(20) },
    address: { type: DataTypes.TEXT },
    city: { type: DataTypes.STRING(100) },
    state: { type: DataTypes.STRING(100) },
    country: { type: DataTypes.STRING(100), defaultValue: "India" },
    pincode: { type: DataTypes.STRING(10) },

    // ── Branding ───────────────────────────────────────────────────────────
    logo: { type: DataTypes.STRING(500) }, // logo URL
    primaryColor: { type: DataTypes.STRING(20) }, // "#1a73e8" — future white-label

    // ── Plan & Billing ─────────────────────────────────────────────────────
    plan: {
      type: DataTypes.ENUM("free", "pro", "enterprise"),
      defaultValue: "free",
    },
    maxUsers: { type: DataTypes.INTEGER, defaultValue: 5 },
    maxAssets: { type: DataTypes.INTEGER, defaultValue: 100 },
    planExpiresAt: { type: DataTypes.DATE },

    // ── Status ─────────────────────────────────────────────────────────────
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },

    // ── Meta ───────────────────────────────────────────────────────────────
    onboardedAt: { type: DataTypes.DATE }, // jab pehli baar login kiya
    settings: { type: DataTypes.JSON }, // tenant-level quick settings
  },
  {
    tableName: "tenants",
    indexes: [{ fields: ["slug"] }, { fields: ["isActive"] }],
  },
);

module.exports = Tenant;
