// Seed: Menus aur default roles create karo
const { Menu, Role, RolePermission } = require("../models/Permission");

const MENUS = [
  {
    name: "Dashboard",
    slug: "dashboard",
    icon: "LayoutDashboard",
    order: 1,
    availableActions: ["view"],
  },
  {
    name: "Asset Master",
    slug: "asset_master",
    icon: "Package",
    order: 2,
    availableActions: ["view", "new", "edit", "delete", "import", "export"],
  },
  {
    name: "Maintenance",
    slug: "maintenance",
    icon: "Wrench",
    order: 3,
    availableActions: ["view", "new", "edit", "delete", "export"],
  },
  {
    name: "Approvals",
    slug: "approvals",
    icon: "CheckSquare",
    order: 4,
    availableActions: ["view", "approve", "reject"],
  },
  {
    name: "Reports",
    slug: "reports",
    icon: "BarChart2",
    order: 5,
    availableActions: ["view", "export"],
  },
  {
    name: "Users",
    slug: "users",
    icon: "Users",
    order: 6,
    availableActions: ["view", "new", "edit", "delete"],
  },
  {
    name: "Roles",
    slug: "roles",
    icon: "Shield",
    order: 7,
    availableActions: ["view", "new", "edit", "delete"],
  },
  {
    name: "Locations",
    slug: "locations",
    icon: "MapPin",
    order: 8,
    availableActions: ["view", "new", "edit", "delete"],
  },
  {
    name: "Settings",
    slug: "settings",
    icon: "Settings",
    order: 9,
    availableActions: ["view", "edit"],
  },
];

// Default role permissions
const ROLE_PERMISSIONS = {
  admin: {}, // Admin ko sab milta hai — DB entry ki zaroorat nahi
  manager: {
    dashboard: { view: true },
    asset_master: {
      view: true,
      new: true,
      edit: true,
      delete: false,
      import: false,
      export: true,
    },
    maintenance: {
      view: true,
      new: true,
      edit: true,
      delete: false,
      export: true,
    },
    approvals: { view: true, approve: true, reject: true },
    reports: { view: true, export: true },
    users: { view: true, new: false, edit: false, delete: false },
  },
  technician: {
    dashboard: { view: true },
    asset_master: {
      view: true,
      new: false,
      edit: false,
      delete: false,
      import: false,
      export: false,
    },
    maintenance: {
      view: true,
      new: true,
      edit: true,
      delete: false,
      export: false,
    },
    approvals: { view: true, approve: false, reject: false },
  },
  viewer: {
    dashboard: { view: true },
    asset_master: {
      view: true,
      new: false,
      edit: false,
      delete: false,
      import: false,
      export: false,
    },
    maintenance: {
      view: true,
      new: false,
      edit: false,
      delete: false,
      export: false,
    },
    reports: { view: true, export: false },
  },
};

async function seedMenusAndRoles() {
  // console.log("🌱 Seeding menus and roles...");

  // Menus seed karo
  for (const menu of MENUS) {
    await Menu.findOrCreate({ where: { slug: menu.slug }, defaults: menu });
  }
  // console.log("✅ Menus seeded");

  // Default roles seed karo
  const roleNames = [
    {
      name: "Admin",
      slug: "admin",
      description: "Full system access",
      isSystem: true,
    },
    {
      name: "Manager",
      slug: "manager",
      description: "Manage assets and approvals",
      isSystem: true,
    },
    {
      name: "Technician",
      slug: "technician",
      description: "Handle maintenance tasks",
      isSystem: true,
    },
    {
      name: "Viewer",
      slug: "viewer",
      description: "Read-only access",
      isSystem: true,
    },
  ];

  for (const roleData of roleNames) {
    const [role] = await Role.findOrCreate({
      where: { slug: roleData.slug },
      defaults: roleData,
    });

    // Role permissions seed karo
    const perms = ROLE_PERMISSIONS[roleData.slug];
    if (perms && Object.keys(perms).length > 0) {
      for (const [menuSlug, actions] of Object.entries(perms)) {
        const menu = await Menu.findOne({ where: { slug: menuSlug } });
        if (menu) {
          await RolePermission.findOrCreate({
            where: { roleId: role.id, menuId: menu.id },
            defaults: { roleId: role.id, menuId: menu.id, actions },
          });
        }
      }
    }
  }
  // console.log("✅ Roles and permissions seeded");
}

module.exports = { seedMenusAndRoles };
