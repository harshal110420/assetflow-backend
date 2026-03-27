require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const sequelize = require("./config/database");
const routes = require("./routes/index");
const http = require("http");
const socketService = require("./socket");

// ── Models ────────────────────────────────────────────────────────────────────
const Tenant = require("./models/Tenant");
const User = require("./models/User");
const Asset = require("./models/Asset");
const Setting = require("./models/Setting");
const Employee = require("./models/Employee");
const Division = require("./models/Division");
const Department = require("./models/Department");
const EmployeeDivision = require("./models/EmployeeDivision");
const AmcContract = require("./models/AmcContract");
const AmcServiceVisit = require("./models/AmcServiceVisit");
const Brand = require("./models/Brand");
const Vendor = require("./models/Vendor");

const {
  Maintenance,
  Assignment,
  AuditLog,
  Category,
  SubCategory,
} = require("./models/index");

const {
  Menu,
  Role,
  RolePermission,
  UserPermission,
  Location,
  UserLocation,
} = require("./models/Permission");

const {
  ApprovalTemplate,
  ApprovalTemplateStep,
  ApprovalRequest,
  ApprovalRequestStep,
} = require("./models/Approval");

// ── Tenant Associations ───────────────────────────────────────────────────────
Tenant.hasMany(User, { foreignKey: "tenantId", as: "users" });
Tenant.hasMany(Employee, { foreignKey: "tenantId", as: "employees" });
Tenant.hasMany(Asset, { foreignKey: "tenantId", as: "assets" });
Tenant.hasMany(Department, { foreignKey: "tenantId", as: "departments" });
Tenant.hasMany(Division, { foreignKey: "tenantId", as: "divisions" });
Tenant.hasMany(Location, { foreignKey: "tenantId", as: "locations" });
Tenant.hasMany(Role, { foreignKey: "tenantId", as: "roles" });
Tenant.hasMany(RolePermission, {
  foreignKey: "tenantId",
  as: "rolePermissions",
});
Tenant.hasMany(UserPermission, {
  foreignKey: "tenantId",
  as: "userPermissions",
});
Tenant.hasMany(Maintenance, { foreignKey: "tenantId", as: "maintenances" });
Tenant.hasMany(Assignment, { foreignKey: "tenantId", as: "assignments" });
Tenant.hasMany(Setting, { foreignKey: "tenantId", as: "tenantSettings" });
Tenant.hasMany(ApprovalTemplate, {
  foreignKey: "tenantId",
  as: "approvalTemplates",
});
Tenant.hasMany(ApprovalRequest, {
  foreignKey: "tenantId",
  as: "approvalRequests",
});
Tenant.hasMany(AuditLog, { foreignKey: "tenantId", as: "auditLogs" });
Tenant.hasMany(EmployeeDivision, {
  foreignKey: "tenantId",
  as: "employeeDivisions",
});
Tenant.hasMany(UserLocation, { foreignKey: "tenantId", as: "userLocations" });
Tenant.hasMany(Category, { foreignKey: "tenantId", as: "categories" }); // ← ADD
Tenant.hasMany(SubCategory, { foreignKey: "tenantId", as: "subCategories" }); // ← ADD
Tenant.hasMany(AmcContract, { foreignKey: "tenantId", as: "amcContracts" });
Tenant.hasMany(AmcServiceVisit, {
  foreignKey: "tenantId",
  as: "amcServiceVisits",
});
Tenant.hasMany(Brand, { foreignKey: "tenantId", as: "brands" });
Tenant.hasMany(Vendor, { foreignKey: "tenantId", as: "vendors" });

// Reverse — belongsTo Tenant
User.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });
Employee.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });
Asset.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });
Department.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });
Division.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });
Location.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });
Role.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });
RolePermission.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });
UserPermission.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });
Maintenance.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });
Assignment.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });
Setting.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });
ApprovalTemplate.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });
ApprovalRequest.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });
AuditLog.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });
Category.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" }); // ← ADD
SubCategory.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" }); // ← ADD

// ── Category → SubCategory ────────────────────────────────────────────────────
Category.hasMany(SubCategory, {
  foreignKey: "categoryId",
  as: "subCategories",
});
SubCategory.belongsTo(Category, { foreignKey: "categoryId", as: "category" });

// ── Asset → Category / SubCategory ───────────────────────────────────────────
Asset.belongsTo(Category, { foreignKey: "categoryId", as: "category" }); // ← ADD
Asset.belongsTo(SubCategory, {
  foreignKey: "subCategoryId",
  as: "subCategory",
}); // ← ADD
Category.hasMany(Asset, { foreignKey: "categoryId", as: "categoryAssets" }); // ← ADD
SubCategory.hasMany(Asset, {
  foreignKey: "subCategoryId",
  as: "subCategoryAssets",
}); // ← ADD

// ── User ──────────────────────────────────────────────────────────────────────
Asset.belongsTo(User, { as: "createdBy", foreignKey: "createdById" });
User.belongsTo(User, {
  as: "reportingManager",
  foreignKey: "reportingManagerId",
});

// ── Division → Department ─────────────────────────────────────────────────────
Division.hasMany(Department, { foreignKey: "divisionId", as: "departments" });
Department.belongsTo(Division, { foreignKey: "divisionId", as: "division" });

// ── Employee ──────────────────────────────────────────────────────────────────
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

// ── Asset — Single Custody Model ──────────────────────────────────────────────
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
Department.hasMany(Asset, { as: "assets", foreignKey: "departmentId" });
Asset.belongsTo(Location, { as: "locationObj", foreignKey: "locationId" });
Location.hasMany(Asset, { foreignKey: "locationId" });

// ── Assignment ────────────────────────────────────────────────────────────────
Assignment.belongsTo(Asset, { foreignKey: "assetId" });
Asset.hasMany(Assignment, { foreignKey: "assetId" });
Assignment.belongsTo(Employee, {
  as: "assignedEmployee",
  foreignKey: "employeeId",
});
Assignment.belongsTo(Department, {
  as: "assignedDept",
  foreignKey: "departmentId",
});
Assignment.belongsTo(Location, { as: "assignedLoc", foreignKey: "locationId" });
Employee.hasMany(Assignment, { as: "assignments", foreignKey: "employeeId" });
Department.hasMany(Assignment, {
  as: "departmentAssignments",
  foreignKey: "departmentId",
});
Location.hasMany(Assignment, {
  as: "locationAssignments",
  foreignKey: "locationId",
});
Assignment.belongsTo(User, { as: "assignedBy", foreignKey: "assignedById" });

// ── Maintenance ───────────────────────────────────────────────────────────────
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

// ── Asset → Brand / Vendor ────────────────────────────────────────────────────
Asset.belongsTo(Brand, { foreignKey: "brandId", as: "brandObj" });
Brand.hasMany(Asset, { foreignKey: "brandId", as: "brandAssets" });

Asset.belongsTo(Vendor, { foreignKey: "vendorId", as: "vendorObj" });
Vendor.hasMany(Asset, { foreignKey: "vendorId", as: "vendorAssets" });

// ── Approvals ─────────────────────────────────────────────────────────────────
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

Asset.hasMany(ApprovalRequest, {
  foreignKey: "moduleRecordId",
  as: "approvalRequests",
  constraints: false,
});
// ── Permissions ───────────────────────────────────────────────────────────────
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
User.belongsTo(Role, { as: "roleObj", foreignKey: "roleId" });
Role.hasMany(User, { foreignKey: "roleId", as: "roleUsers" });
AuditLog.belongsTo(User, { foreignKey: "userId", as: "user" });
AmcContract.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });
AmcServiceVisit.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });
AmcContract.belongsToMany(Asset, {
  through: "amc_contract_assets", // junction table — auto create hogi
  foreignKey: "contractId",
  otherKey: "assetId",
  as: "assets",
});
Asset.belongsToMany(AmcContract, {
  through: "amc_contract_assets",
  foreignKey: "assetId",
  otherKey: "contractId",
  as: "amcContracts",
});

// AmcContract -> AmcServiceVisit  (One-to-Many)
AmcContract.hasMany(AmcServiceVisit, {
  foreignKey: "contractId",
  as: "serviceVisits",
});
AmcServiceVisit.belongsTo(AmcContract, {
  foreignKey: "contractId",
  as: "contract",
});

// AmcServiceVisit -> Asset  (visit kis asset ke liye thi)
AmcServiceVisit.belongsTo(Asset, {
  foreignKey: "assetId",
  as: "asset",
});
Asset.hasMany(AmcServiceVisit, {
  foreignKey: "assetId",
  as: "serviceVisits",
});
Brand.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });
Vendor.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });

// ── App Setup ─────────────────────────────────────────────────────────────────
const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      // "http://192.168.137.1:3000",
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    credentials: true,
  }),
);
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", routes);

app.get("/health", async (req, res) => {
  try {
    await sequelize.authenticate(); // ✅ DB bhi ping hoga
    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      version: "2.0.0",
    });
  } catch (err) {
    res.status(500).json({ status: "DB_ERROR", message: err.message });
  }
});

app.use("*", (req, res) =>
  res.status(404).json({ success: false, message: "Route not found" }),
);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");
    await sequelize.sync({ alter: process.env.DB_ALTER === "true" });
    console.log("✅ Database synchronized");

    // http server banao
    const httpServer = http.createServer(app);

    // Socket.io init karo
    socketService.init(httpServer);

    // app.listen ki jagah httpServer.listen
    httpServer.listen(PORT, () =>
      console.log(`🚀 Server running on port ${PORT}`),
    );
  } catch (error) {
    console.error("❌ Server failed to start:", error);
    process.exit(1);
  }
};

startServer();
