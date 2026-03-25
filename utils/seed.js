require("dotenv").config();
const sequelize = require("../config/database");

// ── Models ────────────────────────────────────────────────────────────────────
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

// ── Associations ──────────────────────────────────────────────────────────────
// User
Asset.belongsTo(User, { as: "createdBy", foreignKey: "createdById" });
AuditLog.belongsTo(User, { foreignKey: "userId" });
User.belongsTo(User, {
  as: "reportingManager",
  foreignKey: "reportingManagerId",
});

// Division → Department
Division.hasMany(Department, { foreignKey: "divisionId", as: "departments" });
Department.belongsTo(Division, { foreignKey: "divisionId", as: "division" });

// Employee
Employee.belongsTo(Department, {
  as: "department",
  foreignKey: "departmentId",
});
Department.hasMany(Employee, { foreignKey: "departmentId", as: "employees" });
Employee.belongsTo(Location, { as: "branch", foreignKey: "locationId" });
Location.hasMany(Employee, { foreignKey: "locationId", as: "employees" });
Employee.belongsTo(Employee, {
  as: "reportingManager",
  foreignKey: "reportingManagerId",
});
Employee.hasMany(Employee, {
  as: "subordinates",
  foreignKey: "reportingManagerId",
});
Employee.belongsTo(User, { as: "systemUser", foreignKey: "userId" });
User.hasOne(Employee, { foreignKey: "userId", as: "employeeProfile" });

// Employee ↔ Division (Many-to-Many)
Employee.belongsToMany(Division, {
  through: EmployeeDivision,
  foreignKey: "employeeId",
  as: "divisions",
});
Division.belongsToMany(Employee, {
  through: EmployeeDivision,
  foreignKey: "divisionId",
  as: "employees",
});

// ✅ NAYA — ye add karo
Asset.belongsTo(Employee, {
  as: "assignedToEmployee",
  foreignKey: "assignedToId",
});
Asset.belongsTo(Department, {
  as: "assignedToDept",
  foreignKey: "assignedToDeptId",
});
Asset.belongsTo(Location, {
  as: "assignedToLoc",
  foreignKey: "assignedToLocId",
});
Employee.hasMany(Asset, { as: "assignedAssets", foreignKey: "assignedToId" });
Department.hasMany(Asset, {
  as: "departmentAssets",
  foreignKey: "assignedToDeptId",
});
Location.hasMany(Asset, {
  as: "locationAssets",
  foreignKey: "assignedToLocId",
});

Asset.belongsTo(Department, { as: "department", foreignKey: "departmentId" });
Department.hasMany(Asset, { foreignKey: "departmentId", as: "assets" });
Asset.belongsTo(Location, { as: "locationObj", foreignKey: "locationId" });
Location.hasMany(Asset, { foreignKey: "locationId" });

// Maintenance
Maintenance.belongsTo(Asset, { foreignKey: "assetId" });
Asset.hasMany(Maintenance, { foreignKey: "assetId" });
Maintenance.belongsTo(Employee, {
  as: "technician",
  foreignKey: "technicianId",
});
Employee.hasMany(Maintenance, {
  as: "maintenanceTasks",
  foreignKey: "technicianId",
});

// Assignment
Assignment.belongsTo(Asset, { foreignKey: "assetId" });
Asset.hasMany(Assignment, { foreignKey: "assetId" });
Assignment.belongsTo(Employee, {
  as: "assignedEmployee",
  foreignKey: "employeeId",
});
Employee.hasMany(Assignment, { as: "assignments", foreignKey: "employeeId" });
Assignment.belongsTo(User, { as: "assignedBy", foreignKey: "assignedById" });

// Permissions
RolePermission.belongsTo(Role, { foreignKey: "roleId" });
RolePermission.belongsTo(Menu, { foreignKey: "menuId" });
Role.hasMany(RolePermission, { foreignKey: "roleId" });
UserPermission.belongsTo(User, { foreignKey: "userId" });
UserPermission.belongsTo(Menu, { foreignKey: "menuId" });
User.hasMany(UserPermission, { foreignKey: "userId" });
UserLocation.belongsTo(User, { foreignKey: "userId" });
UserLocation.belongsTo(Location, { foreignKey: "locationId" });
User.hasMany(UserLocation, { foreignKey: "userId" });
Location.hasMany(UserLocation, { foreignKey: "locationId" });
User.belongsTo(Department, { as: "department", foreignKey: "departmentId" });
Department.hasMany(User, { foreignKey: "departmentId", as: "users" });

// Approvals
ApprovalTemplate.hasMany(ApprovalTemplateStep, { foreignKey: "templateId" });
ApprovalTemplateStep.belongsTo(ApprovalTemplate, { foreignKey: "templateId" });
ApprovalRequest.belongsTo(ApprovalTemplate, { foreignKey: "templateId" });
ApprovalRequest.hasMany(ApprovalRequestStep, { foreignKey: "requestId" });
ApprovalRequestStep.belongsTo(ApprovalRequest, { foreignKey: "requestId" });
ApprovalRequest.belongsTo(User, {
  as: "requestedBy",
  foreignKey: "requestedById",
});
ApprovalRequestStep.belongsTo(User, {
  as: "assignedTo",
  foreignKey: "assignedToUserId",
});

// ── Menus ─────────────────────────────────────────────────────────────────────
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

// ── Role Permissions ──────────────────────────────────────────────────────────
const ROLE_PERMISSIONS = {
  admin: {}, // Full access — no DB entry needed
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

// ── Default Settings ──────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = [
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

// ── Main Seed Function ────────────────────────────────────────────────────────
const seed = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    await sequelize.sync({ force: true });
    console.log("✅ Tables created fresh");

    // ── 1. Locations ──────────────────────────────────────────────────────────
    const [mainOffice, branchA, branchB] = await Promise.all([
      Location.create({
        name: "Main Office",
        code: "HQ",
        address: "HQ Building, Nagpur",
        city: "Nagpur",
        state: "Maharashtra",
        country: "India",
        isActive: true,
      }),
      Location.create({
        name: "Branch A",
        code: "BRA",
        address: "Branch A, Nagpur",
        city: "Nagpur",
        state: "Maharashtra",
        country: "India",
        isActive: true,
      }),
      Location.create({
        name: "Branch B",
        code: "BRB",
        address: "Branch B, Nagpur",
        city: "Nagpur",
        state: "Maharashtra",
        country: "India",
        isActive: true,
      }),
    ]);
    console.log("✅ Locations created");

    // ── 2. Divisions ──────────────────────────────────────────────────────────
    const [divIceCream, divSnacks, divBakery, divDairy] = await Promise.all([
      Division.create({
        name: "Ice Cream",
        code: "ICE",
        description: "Ice cream product line",
        isActive: true,
      }),
      Division.create({
        name: "Snacks",
        code: "SNK",
        description: "Snacks product line",
        isActive: true,
      }),
      Division.create({
        name: "Bakery",
        code: "BAK",
        description: "Bakery product line",
        isActive: true,
      }),
      Division.create({
        name: "Dairy",
        code: "DAI",
        description: "Dairy product line",
        isActive: true,
      }),
    ]);
    console.log("✅ Divisions created");

    // ── 3. Departments ────────────────────────────────────────────────────────
    // Common departments under each division
    const deptData = [
      // Ice Cream
      { name: "IC - Production", code: "IC-PROD", divisionId: divIceCream.id },
      { name: "IC - Sales", code: "IC-SALES", divisionId: divIceCream.id },
      { name: "IC - Quality", code: "IC-QC", divisionId: divIceCream.id },
      // Snacks
      { name: "SN - Production", code: "SN-PROD", divisionId: divSnacks.id },
      { name: "SN - Sales", code: "SN-SALES", divisionId: divSnacks.id },
      { name: "SN - Quality", code: "SN-QC", divisionId: divSnacks.id },
      // Bakery
      { name: "BK - Production", code: "BK-PROD", divisionId: divBakery.id },
      { name: "BK - Sales", code: "BK-SALES", divisionId: divBakery.id },
      { name: "BK - Quality", code: "BK-QC", divisionId: divBakery.id },
      // Dairy
      { name: "DA - Production", code: "DA-PROD", divisionId: divDairy.id },
      { name: "DA - Sales", code: "DA-SALES", divisionId: divDairy.id },
      { name: "DA - Quality", code: "DA-QC", divisionId: divDairy.id },
      // Common/Shared
      { name: "IT", code: "IT", divisionId: divIceCream.id }, // IT is under IC as example
      { name: "HR", code: "HR", divisionId: divIceCream.id },
      { name: "Finance", code: "FIN", divisionId: divIceCream.id },
    ];

    const departments = await Promise.all(
      deptData.map((d) => Department.create({ ...d, isActive: true })),
    );

    // Department map for easy reference
    const deptMap = {};
    departments.forEach((d) => {
      deptMap[d.code] = d;
    });
    console.log("✅ Departments created");

    // ── 4. Menus ──────────────────────────────────────────────────────────────
    for (const menu of MENUS) {
      await Menu.findOrCreate({ where: { slug: menu.slug }, defaults: menu });
    }
    console.log("✅ Menus seeded");

    // ── 5. Roles ──────────────────────────────────────────────────────────────
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

    const rolesMap = {};
    for (const roleData of roleNames) {
      const [role] = await Role.findOrCreate({
        where: { slug: roleData.slug },
        defaults: roleData,
      });
      rolesMap[roleData.slug] = role;

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
    console.log("✅ Roles & permissions seeded");

    // ── 6. System Users ───────────────────────────────────────────────────────
    const admin = await User.create({
      firstName: "Admin",
      lastName: "User",
      email: "admin@assetflow.com",
      password: "admin123",
      role: "admin",
      departmentId: deptMap["IT"].id,
      phone: "+91-9000000001",
      roleId: rolesMap["admin"].id,
    });

    const manager = await User.create({
      firstName: "Sarah",
      lastName: "Johnson",
      email: "sarah@assetflow.com",
      password: "manager123",
      role: "manager",
      departmentId: deptMap["IC-SALES"].id,
      phone: "+91-9000000002",
      roleId: rolesMap["manager"].id,
    });

    const tech = await User.create({
      firstName: "Mike",
      lastName: "Chen",
      email: "mike@assetflow.com",
      password: "tech123",
      role: "technician",
      departmentId: deptMap["IT"].id,
      phone: "+91-9000000003",
      roleId: rolesMap["technician"].id,
    });

    const viewer = await User.create({
      firstName: "Emily",
      lastName: "Davis",
      email: "emily@assetflow.com",
      password: "viewer123",
      role: "viewer",
      departmentId: deptMap["FIN"].id,
      phone: "+91-9000000004",
      roleId: rolesMap["viewer"].id,
    });
    console.log("✅ System users created");

    // ── 7. Employees ──────────────────────────────────────────────────────────
    const emp1 = await Employee.create({
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
    console.log("✅ Employees created");

    // ── 8. Employee ↔ Division mappings ───────────────────────────────────────
    await Promise.all([
      EmployeeDivision.create({
        employeeId: emp1.id,
        divisionId: divIceCream.id,
        isPrimary: true,
      }),
      EmployeeDivision.create({
        employeeId: emp2.id,
        divisionId: divSnacks.id,
        isPrimary: true,
      }),
      EmployeeDivision.create({
        employeeId: emp2.id,
        divisionId: divBakery.id,
        isPrimary: false,
      }),
      EmployeeDivision.create({
        employeeId: emp3.id,
        divisionId: divDairy.id,
        isPrimary: true,
      }),
      EmployeeDivision.create({
        employeeId: emp4.id,
        divisionId: divBakery.id,
        isPrimary: true,
      }),
      EmployeeDivision.create({
        employeeId: emp5.id,
        divisionId: divIceCream.id,
        isPrimary: true,
      }),
      EmployeeDivision.create({
        employeeId: emp5.id,
        divisionId: divSnacks.id,
        isPrimary: false,
      }),
      EmployeeDivision.create({
        employeeId: emp5.id,
        divisionId: divDairy.id,
        isPrimary: false,
      }),
    ]);
    console.log("✅ Employee-Division mappings created");

    // ── 9. Assets ─────────────────────────────────────────────────────────────
    // ── 9. Assets ─────────────────────────────────────────────────────────────────
    const assetsData = [
      {
        assetTag: "AST-001-MBP",
        name: 'MacBook Pro 16"',
        category: "Hardware",
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
        // ✅ Employee assignment
        assignmentType: "employee",
        assignedToId: emp1.id,
        assignedToDeptId: null,
        assignedToLocId: null,
      },
      {
        assetTag: "AST-002-DELL",
        name: "Dell XPS 15",
        category: "Hardware",
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
        // ✅ Employee assignment
        assignmentType: "employee",
        assignedToId: emp2.id,
        assignedToDeptId: null,
        assignedToLocId: null,
      },
      {
        assetTag: "AST-003-HP",
        name: "HP EliteDesk 800",
        category: "Hardware",
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
        // ✅ Department assignment — IT shared desktop
        assignmentType: "department",
        assignedToId: null,
        assignedToDeptId: deptMap["IT"].id,
        assignedToLocId: null,
      },
      {
        assetTag: "AST-004-CISCO",
        name: "Cisco Catalyst 9300",
        category: "Infrastructure",
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
        // ✅ Location assignment — network equipment fixed at HQ
        assignmentType: "location",
        assignedToId: null,
        assignedToDeptId: null,
        assignedToLocId: mainOffice.id,
      },
      {
        assetTag: "AST-005-DESK",
        name: "Standing Desk Pro",
        category: "Furniture",
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
        // ✅ Location assignment — furniture fixed at Branch B
        assignmentType: "location",
        assignedToId: null,
        assignedToDeptId: null,
        assignedToLocId: branchB.id,
      },
      {
        assetTag: "AST-006-CAR",
        name: "Toyota Camry 2023",
        category: "Vehicle",
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
        // ✅ Employee assignment
        assignmentType: "employee",
        assignedToId: emp3.id,
        assignedToDeptId: null,
        assignedToLocId: null,
      },
      {
        assetTag: "AST-007-PROJ",
        name: "Projector BenQ",
        category: "Electronics",
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
        // ✅ Department assignment — conference room projector
        assignmentType: "department",
        assignedToId: null,
        assignedToDeptId: deptMap["SN-SALES"].id,
        assignedToLocId: null,
      },
      {
        assetTag: "AST-008-SW",
        name: "AutoCAD License",
        category: "Software",
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
        // ✅ Department assignment — software license for IC Production
        assignmentType: "department",
        assignedToId: null,
        assignedToDeptId: deptMap["IC-PROD"].id,
        assignedToLocId: null,
      },
      {
        assetTag: "AST-009-SRV",
        name: "Server Dell R750",
        category: "Hardware",
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
        // ✅ Location assignment — server fixed at HQ data center
        assignmentType: "location",
        assignedToId: null,
        assignedToDeptId: null,
        assignedToLocId: mainOffice.id,
      },
      {
        assetTag: "AST-010-IPAD",
        name: 'iPad Pro 12.9"',
        category: "Electronics",
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
        // ✅ Employee assignment
        assignmentType: "employee",
        assignedToId: emp4.id,
        assignedToDeptId: null,
        assignedToLocId: null,
      },
    ];

    const assets = await Promise.all(
      assetsData.map((a) => Asset.create({ ...a, createdById: admin.id })),
    );
    console.log(`✅ ${assets.length} assets created`);

    // ── 10. Assignments ───────────────────────────────────────────────────────────
    await Promise.all([
      Assignment.create({
        assetId: assets[0].id,
        assignmentType: "employee", // ✅
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
        assetId: assets[1].id,
        assignmentType: "employee", // ✅
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
        assetId: assets[2].id,
        assignmentType: "department", // ✅ HP Desktop → IT dept
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
        assetId: assets[3].id,
        assignmentType: "location", // ✅ Cisco → HQ
        employeeId: null,
        departmentId: null,
        locationId: mainOffice.id,
        assignedById: admin.id,
        assignedAt: new Date("2022-08-10"),
        purpose: "Network infrastructure — HQ",
        isActive: true,
        conditionAtAssignment: "Excellent",
      }),
      Assignment.create({
        assetId: assets[4].id,
        assignmentType: "location", // ✅ Desk → Branch B
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
        assetId: assets[5].id,
        assignmentType: "employee", // ✅
        employeeId: emp3.id,
        departmentId: null,
        locationId: null,
        assignedById: manager.id,
        assignedAt: new Date("2023-02-01"),
        purpose: "Site visits and inspections",
        isActive: true,
        conditionAtAssignment: "Excellent",
      }),
      Assignment.create({
        assetId: assets[7].id,
        assignmentType: "department", // ✅ AutoCAD → IC-PROD dept
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
        assetId: assets[8].id,
        assignmentType: "location", // ✅ Server → HQ
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
        assetId: assets[9].id,
        assignmentType: "employee", // ✅
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
    console.log("✅ Assignments created");

    // ── 11. Maintenance ───────────────────────────────────────────────────────
    await Promise.all([
      Maintenance.create({
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
        assetId: assets[8].id,
        type: "Preventive",
        title: "Server health check & backup",
        description: "Monthly server maintenance and backup verification",
        status: "Completed",
        priority: "High",
        scheduledDate: "2025-01-30",
        completedDate: "2025-01-30",
        cost: 0,
        technicianId: emp5.id,
      }),
    ]);
    console.log("✅ Maintenance records created");

    // ── 12. Settings ──────────────────────────────────────────────────────────
    for (const setting of DEFAULT_SETTINGS) {
      await Setting.findOrCreate({
        where: { key: setting.key },
        defaults: setting,
      });
    }
    console.log("✅ Settings seeded");

    // ── Done! ─────────────────────────────────────────────────────────────────
    console.log("\n🎉 Database seeded successfully!");
    console.log("\n📋 System User Credentials:");
    console.log("  Admin:      admin@assetflow.com   / admin123");
    console.log("  Manager:    sarah@assetflow.com   / manager123");
    console.log("  Technician: mike@assetflow.com    / tech123");
    console.log("  Viewer:     emily@assetflow.com   / viewer123");
    console.log("\n👷 Demo Employees:");
    console.log("  EMP001 - Rahul Sharma    (IC - Production, Main Office)");
    console.log("  EMP002 - Priya Patil     (SN - Sales, Branch A)");
    console.log("  EMP003 - Amit Deshmukh   (DA - Quality, Main Office)");
    console.log("  EMP004 - Sneha Kulkarni  (BK - Production, Branch B)");
    console.log("  EMP005 - Vikram Joshi    (IT, Main Office)");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    console.error(error.stack);
    process.exit(1);
  }
};

seed();
