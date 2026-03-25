const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// ── 1. MENUS TABLE ────────────────────────────────────────────────────────────
// Sare modules/pages ki list — ye system ka "map" hai
const Menu = sequelize.define(
  "Menu",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(100), allowNull: false }, // "Asset Master"
    slug: { type: DataTypes.STRING(100), allowNull: false, unique: true }, // "asset_master"
    icon: { type: DataTypes.STRING(100) }, // "Package" (lucide icon name)
    parentId: { type: DataTypes.UUID, allowNull: true }, // Future: sub-menus
    order: { type: DataTypes.INTEGER, defaultValue: 0 }, // Sidebar order
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    // Kaunse actions is menu ke liye valid hain
    availableActions: {
      type: DataTypes.JSON,
      defaultValue: ["view", "new", "edit", "delete", "import", "export"],
    },
  },
  { tableName: "menus" },
);

// ── 2. ROLES TABLE ────────────────────────────────────────────────────────────
// Role master — Admin roles banayega
const Role = sequelize.define(
  "Role",
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

    name: { type: DataTypes.STRING(100), allowNull: false }, // "Inventory Manager"
    slug: { type: DataTypes.STRING(100), allowNull: false }, // "inventory_manager"
    description: { type: DataTypes.TEXT },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    isSystem: { type: DataTypes.BOOLEAN, defaultValue: false }, // true = delete nahi kar sakte (admin role)
  },
  {
    tableName: "roles",
    indexes: [
      {
        unique: true,
        fields: ["slug", "tenantId"],
        name: "roles_slug_tenant_unique",
      },
      {
        unique: true,
        fields: ["name", "tenantId"],
        name: "roles_name_tenant_unique",
      },
      { fields: ["tenantId"] },
    ],
  },
);

// ── 3. ROLE PERMISSIONS TABLE ─────────────────────────────────────────────────
// Har role ke liye default permissions
// Ye user se directly touch nahi hoti
const RolePermission = sequelize.define(
  "RolePermission",
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

    roleId: { type: DataTypes.UUID, allowNull: false },
    menuId: { type: DataTypes.UUID, allowNull: false },
    // Actions JSON: { view: true, new: true, edit: true, delete: false, import: false, export: true }
    actions: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
  },
  {
    tableName: "role_permissions",
    indexes: [{ fields: ["tenantId"] }, { fields: ["roleId"] }],
  },
);

// ── 4. USER PERMISSIONS TABLE ─────────────────────────────────────────────────
// User specific FINAL permissions
// EMPTY = role se chalo
// HAS DATA = yahi use karo (role ignore)
const UserPermission = sequelize.define(
  "UserPermission",
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

    userId: { type: DataTypes.UUID, allowNull: false },
    menuId: { type: DataTypes.UUID, allowNull: false },
    // Final merged actions: role base + manual changes
    actions: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    createdBy: { type: DataTypes.UUID },
    modifiedBy: { type: DataTypes.UUID },
  },
  {
    tableName: "user_permissions",
    indexes: [{ fields: ["tenantId"] }, { fields: ["userId"] }],
  },
);

// ── 5. LOCATIONS TABLE ────────────────────────────────────────────────────────
// Admin dynamically add/remove kar sakta hai
const Location = sequelize.define(
  "Location",
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

    name: { type: DataTypes.STRING(100), allowNull: false }, // "Plant 1", "Warehouse"
    code: { type: DataTypes.STRING(20) }, // "PLT1", "WH1"
    address: { type: DataTypes.TEXT },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    createdBy: { type: DataTypes.UUID },
  },
  {
    tableName: "locations",
    indexes: [{ fields: ["tenantId"] }],
  },
);

// ── 6. USER LOCATIONS TABLE ───────────────────────────────────────────────────
// User ko kaunsi locations access hain
const UserLocation = sequelize.define(
  "UserLocation",
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

    userId: { type: DataTypes.UUID, allowNull: false },
    locationId: { type: DataTypes.UUID, allowNull: false },
    createdBy: { type: DataTypes.UUID },
  },
  {
    tableName: "user_locations",
    updatedAt: false,
    indexes: [{ fields: ["tenantId"] }],
  },
);

module.exports = {
  Menu,
  Role,
  RolePermission,
  UserPermission,
  Location,
  UserLocation,
};
