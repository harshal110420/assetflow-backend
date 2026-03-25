// seeders/masterSeeder.js
// ─────────────────────────────────────────────────────────────────────────────
// RUN KARNE KA TARIKA:
//   node seeders/masterSeeder.js
//
// PEHLE SERVER MEIN YE KARO:
//   await sequelize.sync({ force: true });   ← fresh DB
//   phir: node seeders/masterSeeder.js
// ─────────────────────────────────────────────────────────────────────────────

require("dotenv").config();
const sequelize = require("../config/database");

// ── Models ────────────────────────────────────────────────────────────────────
const Tenant = require("../models/Tenant");
const User = require("../models/User");
const Asset = require("../models/Asset");
const Employee = require("../models/Employee");
const Division = require("../models/Division");
const Department = require("../models/Department");
const EmployeeDivision = require("../models/EmployeeDivision");
const Setting = require("../models/Setting");

const {
  Maintenance,
  Assignment,
  AuditLog,
  Category,
  SubCategory,
} = require("../models/index");
const {
  Menu,
  Role,
  RolePermission,
  UserPermission,
  Location,
  UserLocation,
} = require("../models/Permission");
const {
  ApprovalTemplate,
  ApprovalTemplateStep,
  ApprovalRequest,
  ApprovalRequestStep,
} = require("../models/Approval");

// ── Menu Data (Global — no tenantId) ─────────────────────────────────────────
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
    name: "Employees",
    slug: "employees",
    icon: "UserCheck",
    order: 6,
    availableActions: ["view", "new", "edit", "delete"],
  },
  {
    name: "Users",
    slug: "users",
    icon: "Users",
    order: 7,
    availableActions: ["view", "new", "edit", "delete"],
  },
  {
    name: "Roles",
    slug: "roles",
    icon: "Shield",
    order: 8,
    availableActions: ["view", "new", "edit", "delete"],
  },
  {
    name: "Locations",
    slug: "locations",
    icon: "MapPin",
    order: 9,
    availableActions: ["view", "new", "edit", "delete"],
  },
  {
    name: "Divisions",
    slug: "divisions",
    icon: "GitBranch",
    order: 10,
    availableActions: ["view", "new", "edit", "delete"],
  },
  {
    name: "Departments",
    slug: "departments",
    icon: "Briefcase",
    order: 11,
    availableActions: ["view", "new", "edit", "delete"],
  },
  {
    name: "Settings",
    slug: "settings",
    icon: "Settings",
    order: 12,
    availableActions: ["view", "edit"],
  },
];

// ── Role Permission Templates ─────────────────────────────────────────────────
const ROLE_PERMISSIONS = {
  admin: {}, // Admin = full access, no DB entry needed
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
    employees: { view: true, new: true, edit: true, delete: false },
    users: { view: true, new: false, edit: false, delete: false },
    locations: { view: true, new: false, edit: false, delete: false },
    divisions: { view: true, new: false, edit: false, delete: false },
    departments: { view: true, new: false, edit: false, delete: false },
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
    employees: { view: true, new: false, edit: false, delete: false },
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
    employees: { view: true, new: false, edit: false, delete: false },
  },
};

// ── Default Settings Template ─────────────────────────────────────────────────
// tenantId baad mein inject hoga
const SETTINGS_TEMPLATE = [
  {
    key: "company.name",
    value: "AssetFlow AMS",
    type: "string",
    category: "company",
    label: "Company Name",
  },
  {
    key: "company.email",
    value: "",
    type: "string",
    category: "company",
    label: "Company Email",
  },
  {
    key: "company.phone",
    value: "",
    type: "string",
    category: "company",
    label: "Company Phone",
  },
  {
    key: "company.address",
    value: "",
    type: "string",
    category: "company",
    label: "Company Address",
  },
  {
    key: "company.timezone",
    value: "Asia/Kolkata",
    type: "string",
    category: "company",
    label: "Timezone",
  },
  {
    key: "company.currency",
    value: "INR",
    type: "string",
    category: "company",
    label: "Currency",
  },
  {
    key: "company.dateFormat",
    value: "DD/MM/YYYY",
    type: "string",
    category: "company",
    label: "Date Format",
  },
  {
    key: "email.host",
    value: "",
    type: "string",
    category: "email",
    label: "SMTP Host",
  },
  {
    key: "email.port",
    value: "587",
    type: "number",
    category: "email",
    label: "SMTP Port",
  },
  {
    key: "email.secure",
    value: "false",
    type: "boolean",
    category: "email",
    label: "Use SSL/TLS",
  },
  {
    key: "email.user",
    value: "",
    type: "string",
    category: "email",
    label: "SMTP Username",
  },
  {
    key: "email.pass",
    value: "",
    type: "string",
    category: "email",
    label: "SMTP Password",
  },
  {
    key: "email.fromName",
    value: "AssetFlow AMS",
    type: "string",
    category: "email",
    label: "From Name",
  },
  {
    key: "email.fromEmail",
    value: "",
    type: "string",
    category: "email",
    label: "From Email",
  },
  {
    key: "email.enabled",
    value: "true",
    type: "boolean",
    category: "email",
    label: "Enable Email Notifications",
  },
  {
    key: "security.adminRole",
    value: "admin",
    type: "string",
    category: "security",
    label: "Admin Role Slug",
    description: "This role bypasses all permission checks",
  },
  {
    key: "security.bypassRoles",
    value: '["admin"]',
    type: "json",
    category: "security",
    label: "Permission Bypass Roles",
  },
  {
    key: "security.approvalBypassRoles",
    value: '["admin"]',
    type: "json",
    category: "security",
    label: "Approval Bypass Roles",
  },
  {
    key: "asset.tagPrefix",
    value: "AST",
    type: "string",
    category: "asset",
    label: "Asset Tag Prefix",
    description: "e.g. AST → AST-001-MBP",
  },
  {
    key: "asset.defaultDepreciation",
    value: "20",
    type: "number",
    category: "asset",
    label: "Default Depreciation Rate (%)",
  },
  {
    key: "asset.warrantyAlertDays",
    value: "30",
    type: "number",
    category: "asset",
    label: "Warranty Alert Days",
  },
  {
    key: "asset.maintenanceAlertDays",
    value: "7",
    type: "number",
    category: "asset",
    label: "Maintenance Due Alert Days",
  },
  {
    key: "asset.autoTagEnabled",
    value: "true",
    type: "boolean",
    category: "asset",
    label: "Auto-generate Asset Tags",
  },
  {
    key: "approval.valueThreshold",
    value: "10000",
    type: "number",
    category: "approval",
    label: "Value Threshold for Approval (₹)",
  },
  {
    key: "approval.autoApproveHours",
    value: "48",
    type: "number",
    category: "approval",
    label: "Auto-approve Timeout (hours)",
  },
  {
    key: "approval.allowSelfApprove",
    value: "false",
    type: "boolean",
    category: "approval",
    label: "Allow Self-approval",
  },
  {
    key: "notification.warrantyReminder",
    value: "true",
    type: "boolean",
    category: "notification",
    label: "Warranty Expiry Reminders",
  },
  {
    key: "notification.maintenanceReminder",
    value: "true",
    type: "boolean",
    category: "notification",
    label: "Maintenance Due Reminders",
  },
  {
    key: "notification.assignmentAlert",
    value: "true",
    type: "boolean",
    category: "notification",
    label: "Asset Assignment Alerts",
  },
  {
    key: "notification.approvalAlert",
    value: "true",
    type: "boolean",
    category: "notification",
    label: "Approval Request Alerts",
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// MAIN SEED FUNCTION
// ═════════════════════════════════════════════════════════════════════════════
const seed = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected\n");

    // ── STEP 1: Sync DB (force: true — fresh tables) ──────────────────────────
    // await sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
    await sequelize.sync({ force: true });
    // await sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("✅ Tables created fresh\n");

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: TENANT CREATE KARO — SABSE PEHLE
    // ─────────────────────────────────────────────────────────────────────────
    console.log("🏢 Creating tenant...");
    const tenant = await Tenant.create({
      name: "AssetFlow Demo",
      slug: "assetflow-demo",
      subdomain: "demo",
      email: "admin@assetflow.com",
      phone: "+91-9000000000",
      address: "HQ Building, Nagpur",
      city: "Nagpur",
      state: "Maharashtra",
      country: "India",
      plan: "pro",
      maxUsers: 50,
      maxAssets: 500,
      isActive: true,
      onboardedAt: new Date(),
    });
    const T = tenant.id; // shorthand — sab jagah use karenge
    console.log(`✅ Tenant: ${tenant.name} (id: ${T})\n`);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: GLOBAL DATA — tenantId nahi lagta
    // ─────────────────────────────────────────────────────────────────────────

    // ── Menus (Global) ────────────────────────────────────────────────────────
    console.log("📋 Creating menus...");
    for (const menu of MENUS) {
      await Menu.findOrCreate({ where: { slug: menu.slug }, defaults: menu });
    }
    const menuMap = {};
    const allMenus = await Menu.findAll();
    allMenus.forEach((m) => (menuMap[m.slug] = m.id));
    console.log(`✅ ${allMenus.length} menus seeded\n`);

    // ── Categories — tenant specific ──────────────────────────────────────────
    console.log("🏷️  Creating categories & subcategories...");
    const [
      catHardware,
      catSoftware,
      catFurniture,
      catVehicle,
      catEquipment,
      catElectronics,
      catInfra,
      catOther,
    ] = await Promise.all([
      Category.create({
        tenantId: T,
        name: "Hardware",
        depreciationRate: 25.0,
        usefulLife: 4,
      }),
      Category.create({
        tenantId: T,
        name: "Software",
        depreciationRate: 33.3,
        usefulLife: 3,
      }),
      Category.create({
        tenantId: T,
        name: "Furniture",
        depreciationRate: 10.0,
        usefulLife: 10,
      }),
      Category.create({
        tenantId: T,
        name: "Vehicle",
        depreciationRate: 20.0,
        usefulLife: 5,
      }),
      Category.create({
        tenantId: T,
        name: "Equipment",
        depreciationRate: 15.0,
        usefulLife: 7,
      }),
      Category.create({
        tenantId: T,
        name: "Electronics",
        depreciationRate: 25.0,
        usefulLife: 4,
      }),
      Category.create({
        tenantId: T,
        name: "Infrastructure",
        depreciationRate: 5.0,
        usefulLife: 20,
      }),
      Category.create({
        tenantId: T,
        name: "Other",
        depreciationRate: 20.0,
        usefulLife: 5,
      }),
    ]);

    // SubCategories — tenantId ADD
    const subCatRows = await SubCategory.bulkCreate(
      [
        // Hardware
        {
          tenantId: T,
          categoryId: catHardware.id,
          name: "Laptop",
          depreciationRate: 25.0,
          usefulLife: 4,
        },
        {
          tenantId: T,
          categoryId: catHardware.id,
          name: "Desktop",
          depreciationRate: 20.0,
          usefulLife: 5,
        },
        {
          tenantId: T,
          categoryId: catHardware.id,
          name: "Server",
          depreciationRate: 15.0,
          usefulLife: 7,
        },
        {
          tenantId: T,
          categoryId: catHardware.id,
          name: "Printer",
          depreciationRate: 20.0,
          usefulLife: 5,
        },
        {
          tenantId: T,
          categoryId: catHardware.id,
          name: "Scanner",
          depreciationRate: 20.0,
          usefulLife: 5,
        },
        {
          tenantId: T,
          categoryId: catHardware.id,
          name: "Network Device",
          depreciationRate: 15.0,
          usefulLife: 7,
        },
        {
          tenantId: T,
          categoryId: catHardware.id,
          name: "Storage Device",
          depreciationRate: 20.0,
          usefulLife: 5,
        },
        // Software
        {
          tenantId: T,
          categoryId: catSoftware.id,
          name: "License",
          depreciationRate: 33.3,
          usefulLife: 3,
        },
        {
          tenantId: T,
          categoryId: catSoftware.id,
          name: "Subscription",
          depreciationRate: 100,
          usefulLife: 1,
        },
        {
          tenantId: T,
          categoryId: catSoftware.id,
          name: "OS",
          depreciationRate: 33.3,
          usefulLife: 3,
        },
        // Furniture
        {
          tenantId: T,
          categoryId: catFurniture.id,
          name: "Chair",
          depreciationRate: 10.0,
          usefulLife: 10,
        },
        {
          tenantId: T,
          categoryId: catFurniture.id,
          name: "Desk",
          depreciationRate: 10.0,
          usefulLife: 10,
        },
        {
          tenantId: T,
          categoryId: catFurniture.id,
          name: "Workstation",
          depreciationRate: 10.0,
          usefulLife: 10,
        },
        {
          tenantId: T,
          categoryId: catFurniture.id,
          name: "Cabinet",
          depreciationRate: 10.0,
          usefulLife: 10,
        },
        // Vehicle
        {
          tenantId: T,
          categoryId: catVehicle.id,
          name: "Car",
          depreciationRate: 20.0,
          usefulLife: 5,
        },
        {
          tenantId: T,
          categoryId: catVehicle.id,
          name: "Motorcycle",
          depreciationRate: 25.0,
          usefulLife: 4,
        },
        {
          tenantId: T,
          categoryId: catVehicle.id,
          name: "Truck",
          depreciationRate: 15.0,
          usefulLife: 7,
        },
        // Electronics
        {
          tenantId: T,
          categoryId: catElectronics.id,
          name: "Tablet",
          depreciationRate: 25.0,
          usefulLife: 4,
        },
        {
          tenantId: T,
          categoryId: catElectronics.id,
          name: "Phone",
          depreciationRate: 33.3,
          usefulLife: 3,
        },
        {
          tenantId: T,
          categoryId: catElectronics.id,
          name: "Projector",
          depreciationRate: 20.0,
          usefulLife: 5,
        },
        {
          tenantId: T,
          categoryId: catElectronics.id,
          name: "Monitor",
          depreciationRate: 20.0,
          usefulLife: 5,
        },
        {
          tenantId: T,
          categoryId: catElectronics.id,
          name: "Camera",
          depreciationRate: 20.0,
          usefulLife: 5,
        },
        // Infrastructure
        {
          tenantId: T,
          categoryId: catInfra.id,
          name: "UPS",
          depreciationRate: 15.0,
          usefulLife: 7,
        },
        {
          tenantId: T,
          categoryId: catInfra.id,
          name: "Generator",
          depreciationRate: 10.0,
          usefulLife: 10,
        },
        {
          tenantId: T,
          categoryId: catInfra.id,
          name: "AC Unit",
          depreciationRate: 10.0,
          usefulLife: 10,
        },
      ],
      { returning: true },
    );

    // subcatMap — name se id nikalo — assets mein use hoga
    // e.g. subcatMap["Laptop"] = "uuid-of-laptop-subcategory"
    const subcatMap = {};
    subCatRows.forEach((s) => (subcatMap[s.name] = s.id));

    console.log("✅ Categories & subcategories created\n");

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: TENANT-SPECIFIC DATA — tenantId: T lagega sabko
    // ─────────────────────────────────────────────────────────────────────────

    // ── Locations ─────────────────────────────────────────────────────────────
    console.log("📍 Creating locations...");
    const [mainOffice, branchA, branchB] = await Promise.all([
      Location.create({
        tenantId: T,
        name: "Main Office",
        code: "HQ",
        address: "HQ Building, Nagpur",
        isActive: true,
      }),
      Location.create({
        tenantId: T,
        name: "Branch A",
        code: "BRA",
        address: "Branch A, Nagpur",
        isActive: true,
      }),
      Location.create({
        tenantId: T,
        name: "Branch B",
        code: "BRB",
        address: "Branch B, Nagpur",
        isActive: true,
      }),
    ]);
    console.log("✅ Locations created\n");

    // ── Divisions ─────────────────────────────────────────────────────────────
    console.log("🏭 Creating divisions...");
    const [divIceCream, divSnacks, divBakery, divDairy] = await Promise.all([
      Division.create({
        tenantId: T,
        name: "Ice Cream",
        code: "ICE",
        description: "Ice cream product line",
        isActive: true,
      }),
      Division.create({
        tenantId: T,
        name: "Snacks",
        code: "SNK",
        description: "Snacks product line",
        isActive: true,
      }),
      Division.create({
        tenantId: T,
        name: "Bakery",
        code: "BAK",
        description: "Bakery product line",
        isActive: true,
      }),
      Division.create({
        tenantId: T,
        name: "Dairy",
        code: "DAI",
        description: "Dairy product line",
        isActive: true,
      }),
    ]);
    console.log("✅ Divisions created\n");

    // ── Departments ───────────────────────────────────────────────────────────
    console.log("🏢 Creating departments...");
    const deptData = [
      { name: "IC - Production", code: "IC-PROD", divisionId: divIceCream.id },
      { name: "IC - Sales", code: "IC-SALES", divisionId: divIceCream.id },
      { name: "IC - Quality", code: "IC-QC", divisionId: divIceCream.id },
      { name: "SN - Production", code: "SN-PROD", divisionId: divSnacks.id },
      { name: "SN - Sales", code: "SN-SALES", divisionId: divSnacks.id },
      { name: "SN - Quality", code: "SN-QC", divisionId: divSnacks.id },
      { name: "BK - Production", code: "BK-PROD", divisionId: divBakery.id },
      { name: "BK - Sales", code: "BK-SALES", divisionId: divBakery.id },
      { name: "BK - Quality", code: "BK-QC", divisionId: divBakery.id },
      { name: "DA - Production", code: "DA-PROD", divisionId: divDairy.id },
      { name: "DA - Sales", code: "DA-SALES", divisionId: divDairy.id },
      { name: "DA - Quality", code: "DA-QC", divisionId: divDairy.id },
      { name: "IT", code: "IT", divisionId: divIceCream.id },
      { name: "HR", code: "HR", divisionId: divIceCream.id },
      { name: "Finance", code: "FIN", divisionId: divIceCream.id },
    ];

    const departments = await Promise.all(
      deptData.map((d) =>
        Department.create({ ...d, tenantId: T, isActive: true }),
      ),
    );
    const deptMap = {};
    departments.forEach((d) => (deptMap[d.code] = d));
    console.log(`✅ ${departments.length} departments created\n`);

    // ── Roles ─────────────────────────────────────────────────────────────────
    console.log("🛡️  Creating roles & permissions...");
    const roleNamesData = [
      {
        name: "Admin",
        slug: "admin",
        description: "Full system access",
        isSystem: true,
      },
      {
        name: "Manager",
        slug: "manager",
        description: "Manage assets & approvals",
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
        isSystem: false,
      },
    ];

    const rolesMap = {};
    for (const roleData of roleNamesData) {
      const [role] = await Role.findOrCreate({
        where: { slug: roleData.slug, tenantId: T },
        defaults: { ...roleData, tenantId: T },
      });
      rolesMap[roleData.slug] = role;

      // Role permissions seed karo
      const perms = ROLE_PERMISSIONS[roleData.slug];
      if (perms && Object.keys(perms).length > 0) {
        for (const [menuSlug, actions] of Object.entries(perms)) {
          if (menuMap[menuSlug]) {
            await RolePermission.findOrCreate({
              where: {
                roleId: role.id,
                menuId: menuMap[menuSlug],
                tenantId: T,
              },
              defaults: {
                tenantId: T,
                roleId: role.id,
                menuId: menuMap[menuSlug],
                actions,
              },
            });
          }
        }
      }
    }
    console.log("✅ Roles & permissions created\n");

    // ── System Users ──────────────────────────────────────────────────────────
    console.log("👤 Creating system users...");
    const admin = await User.create({
      tenantId: T,
      firstName: "Admin",
      lastName: "User",
      email: "admin@assetflow.com",
      password: "admin123",
      role: "admin",
      departmentId: deptMap["IT"].id,
      phone: "+91-9000000001",
      roleId: rolesMap["admin"].id,
      isActive: true,
    });

    const manager = await User.create({
      tenantId: T,
      firstName: "Sarah",
      lastName: "Johnson",
      email: "sarah@assetflow.com",
      password: "manager123",
      role: "manager",
      departmentId: deptMap["IC-SALES"].id,
      phone: "+91-9000000002",
      roleId: rolesMap["manager"].id,
      isActive: true,
    });

    const tech = await User.create({
      tenantId: T,
      firstName: "Mike",
      lastName: "Chen",
      email: "mike@assetflow.com",
      password: "tech123",
      role: "technician",
      departmentId: deptMap["IT"].id,
      phone: "+91-9000000003",
      roleId: rolesMap["technician"].id,
      isActive: true,
    });

    const viewer = await User.create({
      tenantId: T,
      firstName: "Emily",
      lastName: "Davis",
      email: "emily@assetflow.com",
      password: "viewer123",
      role: "viewer",
      departmentId: deptMap["FIN"].id,
      phone: "+91-9000000004",
      roleId: rolesMap["viewer"].id,
      isActive: true,
    });
    console.log("✅ System users created\n");

    // ── Employees ─────────────────────────────────────────────────────────────
    console.log("👷 Creating employees...");
    const emp1 = await Employee.create({
      tenantId: T,
      firstName: "Rahul",
      lastName: "Sharma",
      email: "rahul.sharma@assetflow.com",
      phone: "+91-9100000001",
      employeeCode: "EMP001",
      designation: "Production Manager",
      employmentType: "Full-time",
      departmentId: deptMap["IC-PROD"].id,
      locationId: mainOffice.id,
      joiningDate: "2021-04-01",
      isActive: true,
    });
    const emp2 = await Employee.create({
      tenantId: T,
      firstName: "Priya",
      lastName: "Patil",
      email: "priya.patil@assetflow.com",
      phone: "+91-9100000002",
      employeeCode: "EMP002",
      designation: "Sales Executive",
      employmentType: "Full-time",
      departmentId: deptMap["SN-SALES"].id,
      locationId: branchA.id,
      joiningDate: "2022-06-15",
      isActive: true,
    });
    const emp3 = await Employee.create({
      tenantId: T,
      firstName: "Amit",
      lastName: "Deshmukh",
      email: "amit.deshmukh@assetflow.com",
      phone: "+91-9100000003",
      employeeCode: "EMP003",
      designation: "Quality Inspector",
      employmentType: "Full-time",
      departmentId: deptMap["DA-QC"].id,
      locationId: mainOffice.id,
      joiningDate: "2020-08-10",
      isActive: true,
    });
    const emp4 = await Employee.create({
      tenantId: T,
      firstName: "Sneha",
      lastName: "Kulkarni",
      email: "sneha.kulkarni@assetflow.com",
      phone: "+91-9100000004",
      employeeCode: "EMP004",
      designation: "Bakery Supervisor",
      employmentType: "Full-time",
      departmentId: deptMap["BK-PROD"].id,
      locationId: branchB.id,
      joiningDate: "2023-01-20",
      isActive: true,
      reportingManagerId: emp1.id,
    });
    const emp5 = await Employee.create({
      tenantId: T,
      firstName: "Vikram",
      lastName: "Joshi",
      email: "vikram.joshi@assetflow.com",
      phone: "+91-9100000005",
      employeeCode: "EMP005",
      designation: "IT Technician",
      employmentType: "Contract",
      departmentId: deptMap["IT"].id,
      locationId: mainOffice.id,
      joiningDate: "2023-03-15",
      isActive: true,
    });
    console.log("✅ Employees created\n");

    // ── Employee ↔ Division mappings ──────────────────────────────────────────
    console.log("🔗 Creating employee-division mappings...");
    await Promise.all([
      EmployeeDivision.create({
        tenantId: T,
        employeeId: emp1.id,
        divisionId: divIceCream.id,
        isPrimary: true,
      }),
      EmployeeDivision.create({
        tenantId: T,
        employeeId: emp2.id,
        divisionId: divSnacks.id,
        isPrimary: true,
      }),
      EmployeeDivision.create({
        tenantId: T,
        employeeId: emp2.id,
        divisionId: divBakery.id,
        isPrimary: false,
      }),
      EmployeeDivision.create({
        tenantId: T,
        employeeId: emp3.id,
        divisionId: divDairy.id,
        isPrimary: true,
      }),
      EmployeeDivision.create({
        tenantId: T,
        employeeId: emp4.id,
        divisionId: divBakery.id,
        isPrimary: true,
      }),
      EmployeeDivision.create({
        tenantId: T,
        employeeId: emp5.id,
        divisionId: divIceCream.id,
        isPrimary: true,
      }),
      EmployeeDivision.create({
        tenantId: T,
        employeeId: emp5.id,
        divisionId: divSnacks.id,
        isPrimary: false,
      }),
      EmployeeDivision.create({
        tenantId: T,
        employeeId: emp5.id,
        divisionId: divDairy.id,
        isPrimary: false,
      }),
    ]);
    console.log("✅ Employee-division mappings created\n");

    // ── Assets ────────────────────────────────────────────────────────────────
    console.log("📦 Creating assets...");
    const assetsData = [
      {
        assetTag: "AST-001-MBP",
        name: 'MacBook Pro 16"',
        categoryId: catHardware.id, // ← ENUM hata, FK use
        subCategoryId: subcatMap["Laptop"], // ← SubCategory id
        brand: "Apple",
        model: "MacBook Pro M3",
        serialNumber: "SN-MBP-001",
        status: "Active",
        condition: "Excellent",
        locationId: mainOffice.id,
        departmentId: deptMap["IC-PROD"].id,
        purchaseDate: "2024-01-15",
        purchasePrice: 3499.0,
        currentValue: 3200.0,
        warrantyExpiry: "2027-01-15",
        vendor: "Apple Store",
        assignmentType: "employee",
        assignedToId: emp1.id,
        assignedToDeptId: null,
        assignedToLocId: null,
      },
      {
        assetTag: "AST-002-DELL",
        name: "Dell XPS 15",
        categoryId: catHardware.id,
        subCategoryId: subcatMap["Laptop"],
        brand: "Dell",
        model: "XPS 9520",
        serialNumber: "SN-DELL-001",
        status: "Active",
        condition: "Good",
        locationId: branchA.id,
        departmentId: deptMap["SN-SALES"].id,
        purchaseDate: "2023-06-10",
        purchasePrice: 1899.0,
        currentValue: 1500.0,
        warrantyExpiry: "2026-06-10",
        vendor: "Dell Direct",
        assignmentType: "employee",
        assignedToId: emp2.id,
        assignedToDeptId: null,
        assignedToLocId: null,
      },
      {
        assetTag: "AST-003-HP",
        name: "HP EliteDesk 800",
        categoryId: catHardware.id,
        subCategoryId: subcatMap["Desktop"],
        brand: "HP",
        model: "EliteDesk 800 G9",
        serialNumber: "SN-HP-001",
        status: "Active",
        condition: "Good",
        locationId: mainOffice.id,
        departmentId: deptMap["IT"].id,
        purchaseDate: "2023-03-20",
        purchasePrice: 1299.0,
        currentValue: 1000.0,
        warrantyExpiry: "2026-03-20",
        vendor: "HP Enterprise",
        assignmentType: "department",
        assignedToId: null,
        assignedToDeptId: deptMap["IT"].id,
        assignedToLocId: null,
      },
      {
        assetTag: "AST-004-CISCO",
        name: "Cisco Catalyst 9300",
        categoryId: catInfra.id,
        subCategoryId: subcatMap["Network Device"] || null,
        brand: "Cisco",
        model: "Catalyst 9300-48P",
        serialNumber: "SN-CISCO-001",
        status: "Active",
        condition: "Excellent",
        locationId: mainOffice.id,
        departmentId: deptMap["IT"].id,
        purchaseDate: "2022-08-05",
        purchasePrice: 8500.0,
        currentValue: 7000.0,
        warrantyExpiry: "2027-08-05",
        vendor: "CDW",
        assignmentType: "location",
        assignedToId: null,
        assignedToDeptId: null,
        assignedToLocId: mainOffice.id,
      },
      {
        assetTag: "AST-005-DESK",
        name: "Standing Desk Pro",
        categoryId: catFurniture.id,
        subCategoryId: subcatMap["Desk"],
        brand: "Uplift",
        model: "V2 Commercial",
        serialNumber: "SN-UPLIFT-001",
        status: "Active",
        condition: "Good",
        locationId: branchB.id,
        departmentId: deptMap["HR"].id,
        purchaseDate: "2023-09-01",
        purchasePrice: 1299.0,
        currentValue: 1100.0,
        warrantyExpiry: "2030-09-01",
        vendor: "Uplift Desk",
        assignmentType: "location",
        assignedToId: null,
        assignedToDeptId: null,
        assignedToLocId: branchB.id,
      },
      {
        assetTag: "AST-006-CAR",
        name: "Toyota Camry 2023",
        categoryId: catVehicle.id,
        subCategoryId: subcatMap["Car"],
        brand: "Toyota",
        model: "Camry XSE",
        serialNumber: "VIN-TOY-001",
        status: "Active",
        condition: "Excellent",
        locationId: mainOffice.id,
        departmentId: deptMap["DA-SALES"].id,
        purchaseDate: "2023-01-10",
        purchasePrice: 32000.0,
        currentValue: 28000.0,
        warrantyExpiry: "2026-01-10",
        vendor: "Toyota Dealership",
        assignmentType: "employee",
        assignedToId: emp3.id,
        assignedToDeptId: null,
        assignedToLocId: null,
      },
      {
        assetTag: "AST-007-PROJ",
        name: "Projector BenQ",
        categoryId: catElectronics.id,
        subCategoryId: subcatMap["Projector"],
        brand: "BenQ",
        model: "EW2480",
        serialNumber: "SN-BENQ-001",
        status: "In Maintenance",
        condition: "Fair",
        locationId: branchA.id,
        departmentId: deptMap["SN-SALES"].id,
        purchaseDate: "2021-11-20",
        purchasePrice: 599.0,
        currentValue: 250.0,
        warrantyExpiry: "2024-11-20",
        vendor: "BestBuy",
        assignmentType: "department",
        assignedToId: null,
        assignedToDeptId: deptMap["SN-SALES"].id,
        assignedToLocId: null,
      },
      {
        assetTag: "AST-008-SW",
        name: "AutoCAD License",
        categoryId: catSoftware.id,
        subCategoryId: subcatMap["License"],
        brand: "Autodesk",
        model: "AutoCAD 2024",
        serialNumber: "LIC-ACAD-001",
        status: "Active",
        condition: "Excellent",
        locationId: mainOffice.id,
        departmentId: deptMap["IC-PROD"].id,
        purchaseDate: "2024-01-01",
        purchasePrice: 2000.0,
        currentValue: 1800.0,
        warrantyExpiry: "2024-12-31",
        vendor: "Autodesk",
        assignmentType: "department",
        assignedToId: null,
        assignedToDeptId: deptMap["IC-PROD"].id,
        assignedToLocId: null,
      },
      {
        assetTag: "AST-009-SRV",
        name: "Server Dell R750",
        categoryId: catHardware.id,
        subCategoryId: subcatMap["Server"],
        brand: "Dell",
        model: "PowerEdge R750",
        serialNumber: "SN-DELLSRV-001",
        status: "Active",
        condition: "Good",
        locationId: mainOffice.id,
        departmentId: deptMap["IT"].id,
        purchaseDate: "2022-05-15",
        purchasePrice: 15000.0,
        currentValue: 11000.0,
        warrantyExpiry: "2027-05-15",
        vendor: "Dell Enterprise",
        assignmentType: "location",
        assignedToId: null,
        assignedToDeptId: null,
        assignedToLocId: mainOffice.id,
      },
      {
        assetTag: "AST-010-IPAD",
        name: 'iPad Pro 12.9"',
        categoryId: catElectronics.id,
        subCategoryId: subcatMap["Tablet"],
        brand: "Apple",
        model: "iPad Pro M2",
        serialNumber: "SN-IPAD-001",
        status: "Active",
        condition: "Good",
        locationId: branchB.id,
        departmentId: deptMap["BK-PROD"].id,
        purchaseDate: "2023-10-01",
        purchasePrice: 1099.0,
        currentValue: 950.0,
        warrantyExpiry: "2026-10-01",
        vendor: "Apple Store",
        assignmentType: "employee",
        assignedToId: emp4.id,
        assignedToDeptId: null,
        assignedToLocId: null,
      },
    ];

    const assets = await Promise.all(
      assetsData.map((a) =>
        Asset.create({ ...a, tenantId: T, createdById: admin.id }),
      ),
    );
    console.log(`✅ ${assets.length} assets created\n`);

    // ── Assignments ───────────────────────────────────────────────────────────
    console.log("📋 Creating assignments...");
    await Promise.all([
      Assignment.create({
        tenantId: T,
        assetId: assets[0].id,
        assignmentType: "employee",
        employeeId: emp1.id,
        departmentId: null,
        locationId: null,
        assignedById: admin.id,
        assignedAt: new Date("2024-01-20"),
        purpose: "Work from office",
        isActive: true,
        conditionAtAssignment: "Excellent",
      }),
      Assignment.create({
        tenantId: T,
        assetId: assets[1].id,
        assignmentType: "employee",
        employeeId: emp2.id,
        departmentId: null,
        locationId: null,
        assignedById: admin.id,
        assignedAt: new Date("2023-06-15"),
        purpose: "Field sales work",
        isActive: true,
        conditionAtAssignment: "Good",
      }),
      Assignment.create({
        tenantId: T,
        assetId: assets[2].id,
        assignmentType: "department",
        employeeId: null,
        departmentId: deptMap["IT"].id,
        locationId: null,
        assignedById: admin.id,
        assignedAt: new Date("2023-03-25"),
        purpose: "Shared IT workstation",
        isActive: true,
        conditionAtAssignment: "Good",
      }),
      Assignment.create({
        tenantId: T,
        assetId: assets[3].id,
        assignmentType: "location",
        employeeId: null,
        departmentId: null,
        locationId: mainOffice.id,
        assignedById: admin.id,
        assignedAt: new Date("2022-08-10"),
        purpose: "Network infrastructure HQ",
        isActive: true,
        conditionAtAssignment: "Excellent",
      }),
      Assignment.create({
        tenantId: T,
        assetId: assets[4].id,
        assignmentType: "location",
        employeeId: null,
        departmentId: null,
        locationId: branchB.id,
        assignedById: admin.id,
        assignedAt: new Date("2023-09-05"),
        purpose: "Branch B office furniture",
        isActive: true,
        conditionAtAssignment: "Good",
      }),
      Assignment.create({
        tenantId: T,
        assetId: assets[5].id,
        assignmentType: "employee",
        employeeId: emp3.id,
        departmentId: null,
        locationId: null,
        assignedById: manager.id,
        assignedAt: new Date("2023-02-01"),
        purpose: "Site visits & inspections",
        isActive: true,
        conditionAtAssignment: "Excellent",
      }),
      Assignment.create({
        tenantId: T,
        assetId: assets[7].id,
        assignmentType: "department",
        employeeId: null,
        departmentId: deptMap["IC-PROD"].id,
        locationId: null,
        assignedById: admin.id,
        assignedAt: new Date("2024-01-05"),
        purpose: "IC Production design work",
        isActive: true,
        conditionAtAssignment: "Excellent",
      }),
      Assignment.create({
        tenantId: T,
        assetId: assets[8].id,
        assignmentType: "location",
        employeeId: null,
        departmentId: null,
        locationId: mainOffice.id,
        assignedById: admin.id,
        assignedAt: new Date("2022-05-20"),
        purpose: "HQ Data Center server",
        isActive: true,
        conditionAtAssignment: "Good",
      }),
      Assignment.create({
        tenantId: T,
        assetId: assets[9].id,
        assignmentType: "employee",
        employeeId: emp4.id,
        departmentId: null,
        locationId: null,
        assignedById: manager.id,
        assignedAt: new Date("2023-10-10"),
        purpose: "Production floor monitoring",
        isActive: true,
        conditionAtAssignment: "Good",
      }),
    ]);
    console.log("✅ Assignments created\n");

    // ── Maintenance ───────────────────────────────────────────────────────────
    console.log("🔧 Creating maintenance records...");
    await Promise.all([
      Maintenance.create({
        tenantId: T,
        assetId: assets[6].id,
        type: "Corrective",
        title: "Lamp replacement and lens cleaning",
        description: "Projector lamp needs replacement",
        status: "In Progress",
        priority: "High",
        scheduledDate: "2025-02-15",
        cost: 250.0,
        technicianId: emp5.id,
      }),
      Maintenance.create({
        tenantId: T,
        assetId: assets[3].id,
        type: "Preventive",
        title: "Annual firmware update",
        description: "Update switch firmware to latest version",
        status: "Scheduled",
        priority: "Medium",
        scheduledDate: "2025-03-20",
        cost: 0,
        technicianId: emp5.id,
      }),
      Maintenance.create({
        tenantId: T,
        assetId: assets[5].id,
        type: "Inspection",
        title: "6-month vehicle inspection",
        description: "Routine safety and maintenance check",
        status: "Scheduled",
        priority: "Low",
        scheduledDate: "2025-04-28",
        cost: 150.0,
        vendor: "Toyota Service Center",
      }),
      Maintenance.create({
        tenantId: T,
        assetId: assets[8].id,
        type: "Preventive",
        title: "Server health check & backup",
        description: "Monthly server maintenance and backup",
        status: "Completed",
        priority: "High",
        scheduledDate: "2025-01-30",
        completedDate: "2025-01-30",
        cost: 0,
        technicianId: emp5.id,
      }),
    ]);
    console.log("✅ Maintenance records created\n");

    // ── Settings ──────────────────────────────────────────────────────────────
    console.log("⚙️  Creating settings...");
    for (const s of SETTINGS_TEMPLATE) {
      await Setting.findOrCreate({
        where: { key: s.key, tenantId: T },
        defaults: { ...s, tenantId: T },
      });
    }
    console.log("✅ Settings seeded\n");

    // ─────────────────────────────────────────────────────────────────────────
    // DONE!
    // ─────────────────────────────────────────────────────────────────────────
    console.log("═══════════════════════════════════════════════════");
    console.log("🎉  Database seeded successfully!");
    console.log("═══════════════════════════════════════════════════");
    console.log("\n🏢 Tenant:");
    console.log(`   Name : ${tenant.name}`);
    console.log(`   ID   : ${T}`);
    console.log("\n📋 System User Credentials:");
    console.log("   Admin:      admin@assetflow.com   / admin123");
    console.log("   Manager:    sarah@assetflow.com   / manager123");
    console.log("   Technician: mike@assetflow.com    / tech123");
    console.log("   Viewer:     emily@assetflow.com   / viewer123");
    console.log("\n👷 Demo Employees:");
    console.log("   EMP001 - Rahul Sharma    (IC-PROD,  Main Office)");
    console.log("   EMP002 - Priya Patil     (SN-SALES, Branch A)");
    console.log("   EMP003 - Amit Deshmukh   (DA-QC,    Main Office)");
    console.log("   EMP004 - Sneha Kulkarni  (BK-PROD,  Branch B)");
    console.log("   EMP005 - Vikram Joshi    (IT,       Main Office)");
    console.log("\n📦 Assets: 10 created");
    console.log("📋 Assignments: 9 created");
    console.log("🔧 Maintenance: 4 records");
    console.log("⚙️  Settings: 28 keys per tenant");
    console.log("═══════════════════════════════════════════════════\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

seed();
