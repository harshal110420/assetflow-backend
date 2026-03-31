// routes/index.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const assetController = require("../controllers/assetController");
const maintenanceController = require("../controllers/maintenanceController");
const userController = require("../controllers/userController");
const employeeController = require("../controllers/Employeecontroller");
const divisionDepartmentController = require("../controllers/Divisiondepartmentcontroller");
const approvalController = require("../controllers/approvalController");
const roleController = require("../controllers/roleController");
const permissionController = require("../controllers/permissionController");
const reportController = require("../controllers/Reportcontroller");
const settingController = require("../controllers/settingController");
const categoryController = require("../controllers/Categorycontroller");
const handoverMailController = require("../controllers/handoverMailController");
const auditLogController = require("../controllers/auditLogController");
const importController = require("../controllers/importController");
const amcController = require("../controllers/amcController");
const brandController = require("../controllers/brandController");
const vendorController = require("../controllers/vendorController");
const { protect, authorize } = require("../middleware/auth");
const { checkPermission } = require("../middleware/checkPermission");

// ── YE NAYA HAI ───────────────────────────────────────────────────────────────
const tenantMiddleware = require("../middleware/tenantMiddleware");

// ── Auth (public routes — tenant middleware NAHI lagega) ──────────────────────
router.post("/auth/register", authController.register);
router.post("/auth/login", authController.login);

// ── Auth (protected — tenant middleware lagega) ───────────────────────────────
router.get("/auth/me", protect, tenantMiddleware, authController.getMe);
router.put(
  "/auth/profile",
  protect,
  tenantMiddleware,
  authController.updateProfile,
);
router.put(
  "/auth/password",
  protect,
  tenantMiddleware,
  authController.changePassword,
);

// ── Assets ────────────────────────────────────────────────────────────────────
router.get(
  "/assets/dashboard",
  protect,
  tenantMiddleware,
  assetController.getDashboardStats,
);
router.get("/assets", protect, tenantMiddleware, assetController.getAssets);
router.post(
  "/assets",
  protect,
  tenantMiddleware,
  checkPermission("asset_master", "new"),
  assetController.createAsset,
);
router.get("/assets/:id", protect, tenantMiddleware, assetController.getAsset);
router.put(
  "/assets/:id",
  protect,
  tenantMiddleware,
  checkPermission("asset_master", "edit"),
  assetController.updateAsset,
);
router.delete(
  "/assets/:id",
  protect,
  tenantMiddleware,
  checkPermission("asset_master", "delete"),
  assetController.deleteAsset,
);
router.post(
  "/assets/:id/assign",
  protect,
  tenantMiddleware,
  checkPermission("asset_master", "edit"),
  assetController.assignAsset,
);
router.post(
  "/assets/:id/return",
  protect,
  tenantMiddleware,
  checkPermission("asset_master", "edit"),
  assetController.returnAsset,
);
router.post(
  "/assets/:id/dispose",
  protect,
  tenantMiddleware,
  checkPermission("asset_master", "delete"),
  assetController.disposeAsset,
);
router.post(
  "/assets/:id/transfer",
  protect,
  tenantMiddleware,
  checkPermission("asset_master", "edit"),
  assetController.transferAsset,
);
router.get(
  "/assets/scan/:assetTag",
  protect,
  tenantMiddleware,
  assetController.scanAsset,
);
router.get(
  "/assets/:id/history",
  protect,
  tenantMiddleware,
  assetController.getAssetHistory,
);
router.get(
  "/assets/:id/timeline",
  protect,
  tenantMiddleware,
  assetController.getAssetTimeline,
);
router.post(
  "/assets/regenerate-qr",
  protect,
  tenantMiddleware,
  assetController.regenerateQR,
);
// ── Maintenance ───────────────────────────────────────────────────────────────
router.get(
  "/maintenance/stats",
  protect,
  tenantMiddleware,
  maintenanceController.getMaintenanceStats,
);
router.get(
  "/maintenance",
  protect,
  tenantMiddleware,
  maintenanceController.getMaintenances,
);
router.get(
  "/maintenance/:id",
  protect,
  tenantMiddleware,
  maintenanceController.getMaintenancesById,
);
router.post(
  "/maintenance",
  protect,
  tenantMiddleware,
  checkPermission("maintenance", "new"),
  maintenanceController.createMaintenance,
);
router.put(
  "/maintenance/:id",
  protect,
  tenantMiddleware,
  checkPermission("maintenance", "edit"),
  maintenanceController.updateMaintenance,
);
router.delete(
  "/maintenance/:id",
  protect,
  tenantMiddleware,
  checkPermission("maintenance", "delete"),
  maintenanceController.deleteMaintenance,
);

// ── System Users ──────────────────────────────────────────────────────────────
router.get(
  "/users",
  protect,
  tenantMiddleware,
  checkPermission("users", "view"),
  userController.getUsers,
);
router.post(
  "/users",
  protect,
  tenantMiddleware,
  checkPermission("users", "new"),
  userController.createUser,
);
router.get("/users/:id", protect, tenantMiddleware, userController.getUser);
router.put(
  "/users/:id",
  protect,
  tenantMiddleware,
  checkPermission("users", "edit"),
  userController.updateUser,
);
router.delete(
  "/users/:id",
  protect,
  tenantMiddleware,
  checkPermission("users", "delete"),
  userController.deleteUser,
);

// ── Employees ─────────────────────────────────────────────────────────────────
router.get(
  "/employees",
  protect,
  tenantMiddleware,
  checkPermission("employees", "view"),
  employeeController.getEmployees,
);
router.post(
  "/employees",
  protect,
  tenantMiddleware,
  checkPermission("employees", "new"),
  employeeController.createEmployee,
);
router.get(
  "/employees/:id",
  protect,
  tenantMiddleware,
  checkPermission("employees", "view"),
  employeeController.getEmployee,
);
router.put(
  "/employees/:id",
  protect,
  tenantMiddleware,
  checkPermission("employees", "edit"),
  employeeController.updateEmployee,
);
router.delete(
  "/employees/:id",
  protect,
  tenantMiddleware,
  checkPermission("employees", "delete"),
  employeeController.deleteEmployee,
);
router.get(
  "/employees/:id/asset-timeline",
  protect,
  tenantMiddleware,
  employeeController.getEmployeeAssetTimeline,
);

// ── Divisions ─────────────────────────────────────────────────────────────────
router.get(
  "/divisions",
  protect,
  tenantMiddleware,
  divisionDepartmentController.getDivisions,
);
router.post(
  "/divisions",
  protect,
  tenantMiddleware,
  checkPermission("divisions", "new"),
  divisionDepartmentController.createDivision,
);
router.put(
  "/divisions/:id",
  protect,
  tenantMiddleware,
  checkPermission("divisions", "edit"),
  divisionDepartmentController.updateDivision,
);
router.delete(
  "/divisions/:id",
  protect,
  tenantMiddleware,
  checkPermission("divisions", "delete"),
  divisionDepartmentController.deleteDivision,
);

// ── Departments ───────────────────────────────────────────────────────────────
router.get(
  "/departments",
  protect,
  tenantMiddleware,
  divisionDepartmentController.getDepartments,
);
router.post(
  "/departments",
  protect,
  tenantMiddleware,
  checkPermission("departments", "new"),
  divisionDepartmentController.createDepartment,
);
router.put(
  "/departments/:id",
  protect,
  tenantMiddleware,
  checkPermission("departments", "edit"),
  divisionDepartmentController.updateDepartment,
);
router.delete(
  "/departments/:id",
  protect,
  tenantMiddleware,
  checkPermission("departments", "delete"),
  divisionDepartmentController.deleteDepartment,
);

// ── Approval Templates ────────────────────────────────────────────────────────
router.get(
  "/approval-templates",
  protect,
  tenantMiddleware,
  authorize("admin"),
  approvalController.getTemplates,
);
router.post(
  "/approval-templates",
  protect,
  tenantMiddleware,
  authorize("admin"),
  approvalController.createTemplate,
);
router.put(
  "/approval-templates/:id",
  protect,
  tenantMiddleware,
  authorize("admin"),
  approvalController.updateTemplate,
);
router.delete(
  "/approval-templates/:id",
  protect,
  tenantMiddleware,
  authorize("admin"),
  approvalController.deleteTemplate,
);

// ── Approval Requests ─────────────────────────────────────────────────────────
router.get(
  "/approvals/pending",
  protect,
  tenantMiddleware,
  approvalController.getMyPendingApprovals,
);
router.get(
  "/approvals",
  protect,
  tenantMiddleware,
  checkPermission("approvals", "view"),
  approvalController.getAllRequests,
);
router.get(
  "/approvals/:id",
  protect,
  tenantMiddleware,
  approvalController.getRequest,
);
router.post(
  "/approvals/:id/action",
  protect,
  tenantMiddleware,
  checkPermission("approvals", "view"),
  approvalController.takeAction,
);
router.post(
  "/approvals/:id/cancel",
  protect,
  tenantMiddleware,
  approvalController.cancelRequest,
);

router.post(
  "/assets/:id/send-handover-mail",
  protect,
  tenantMiddleware,
  checkPermission("asset_master", "edit"), // ya "new" — jo bhi appropriate ho
  handoverMailController.sendHandoverMail,
);

// ── Bulk Import ───────────────────────────────────────────────────────────────
router.post(
  "/import/assets",
  protect,
  tenantMiddleware,
  checkPermission("asset_master", "new"),
  importController.uploadMiddleware,
  importController.importAssets,
);

router.post(
  "/import/employees",
  protect,
  tenantMiddleware,
  checkPermission("employees", "new"),
  importController.uploadMiddleware,
  importController.importEmployees,
);

// ── Roles ─────────────────────────────────────────────────────────────────────
router.get("/roles", protect, tenantMiddleware, roleController.getRoles);
router.get("/roles/:id", protect, tenantMiddleware, roleController.getRoleById);
router.post(
  "/roles",
  protect,
  tenantMiddleware,
  checkPermission("roles", "new"),
  roleController.createRole,
);
router.get(
  "/roles/:id/permissions",
  protect,
  tenantMiddleware,
  checkPermission("roles", "view"),
  roleController.getRolePermissions,
);
router.put(
  "/roles/:id",
  protect,
  tenantMiddleware,
  checkPermission("roles", "edit"),
  roleController.updateRolePermissions,
);
router.delete(
  "/roles/:id",
  protect,
  tenantMiddleware,
  checkPermission("roles", "delete"),
  roleController.deleteRole,
);

// ── Menu Management ───────────────────────────────────────────────────────────
router.get(
  "/menus",
  protect,
  tenantMiddleware,
  authorize("admin"),
  permissionController.getAllMenus,
);
router.get(
  "/menus/:id",
  protect,
  tenantMiddleware,
  authorize("admin"),
  permissionController.getMenuById,
);
router.post(
  "/menus",
  protect,
  tenantMiddleware,
  authorize("admin"),
  permissionController.createMenu,
);
router.put(
  "/menus/:id",
  protect,
  tenantMiddleware,
  authorize("admin"),
  permissionController.updateMenu,
);
router.delete(
  "/menus/:id",
  protect,
  tenantMiddleware,
  authorize("admin"),
  permissionController.deleteMenu,
);

// ── Permissions ───────────────────────────────────────────────────────────────
router.get(
  "/permissions/my",
  protect,
  tenantMiddleware,
  permissionController.getMyPermissions,
);
router.get(
  "/permissions/menus",
  protect,
  tenantMiddleware,
  permissionController.getMenus,
);
router.get(
  "/permissions/user/:userId",
  protect,
  tenantMiddleware,
  checkPermission("users", "edit"),
  permissionController.getUserPermissions,
);
router.post(
  "/permissions/user/:userId",
  protect,
  tenantMiddleware,
  checkPermission("users", "edit"),
  permissionController.saveUserPermissions,
);
router.delete(
  "/permissions/user/:userId/reset",
  protect,
  tenantMiddleware,
  checkPermission("users", "edit"),
  permissionController.resetUserPermissions,
);

// ── Reports ───────────────────────────────────────────────────────────────────
router.get(
  "/reports/assets",
  protect,
  tenantMiddleware,
  checkPermission("reports", "view"),
  reportController.getAssetReport,
);
router.get(
  "/reports/maintenance",
  protect,
  tenantMiddleware,
  checkPermission("reports", "view"),
  reportController.getMaintenanceReport,
);
router.get(
  "/reports/assignments",
  protect,
  tenantMiddleware,
  checkPermission("reports", "view"),
  reportController.getAssignmentReport,
);
router.get(
  "/reports/warranty",
  protect,
  tenantMiddleware,
  checkPermission("reports", "view"),
  reportController.getWarrantyReport,
);
router.get(
  "/reports/depreciation",
  protect,
  tenantMiddleware,
  checkPermission("reports", "view"),
  reportController.getDepreciationReport,
);
router.get(
  "/reports/employee-wise",
  protect,
  tenantMiddleware,
  checkPermission("reports", "view"),
  reportController.getEmployeeWiseReport,
);

// ✅ NEW — 4 nayi routes add karo:
router.get(
  "/reports/category-wise",
  protect,
  tenantMiddleware,
  reportController.getCategoryWiseReport,
);
router.get(
  "/reports/location-wise",
  protect,
  tenantMiddleware,
  reportController.getLocationWiseReport,
);
router.get(
  "/reports/configuration",
  protect,
  tenantMiddleware,
  reportController.getConfigurationReport,
);
router.get(
  "/reports/assignment-history",
  protect,
  tenantMiddleware,
  reportController.getAssignmentHistoryReport,
);
router.get(
  "/reports/department-wise",
  protect,
  tenantMiddleware,
  reportController.getDepartmentWiseReport,
);

// ── Settings ──────────────────────────────────────────────────────────────────
router.get(
  "/settings",
  protect,
  tenantMiddleware,
  authorize("admin"),
  settingController.getSettings,
);
router.put(
  "/settings",
  protect,
  tenantMiddleware,
  authorize("admin"),
  settingController.updateSettings,
);
router.get(
  "/settings/category/:category",
  protect,
  tenantMiddleware,
  authorize("admin"),
  settingController.getSettingsByCategory,
);
router.get(
  "/settings/:key",
  protect,
  tenantMiddleware,
  authorize("admin"),
  settingController.getSetting,
);
router.post(
  "/settings/test-email",
  protect,
  tenantMiddleware,
  authorize("admin"),
  settingController.testEmail,
);

// ── Locations ─────────────────────────────────────────────────────────────────
router.get(
  "/locations",
  protect,
  tenantMiddleware,
  permissionController.getLocations,
);
router.post(
  "/locations",
  protect,
  tenantMiddleware,
  checkPermission("locations", "new"),
  permissionController.createLocation,
);
router.put(
  "/locations/:id",
  protect,
  tenantMiddleware,
  checkPermission("locations", "edit"),
  permissionController.updateLocation,
);
router.delete(
  "/locations/:id",
  protect,
  tenantMiddleware,
  checkPermission("locations", "delete"),
  permissionController.deleteLocation,
);
router.get(
  "/locations/user/:userId",
  protect,
  tenantMiddleware,
  checkPermission("users", "edit"),
  permissionController.getUserLocations,
);
router.post(
  "/locations/user/:userId",
  protect,
  tenantMiddleware,
  checkPermission("users", "edit"),
  permissionController.saveUserLocations,
);

// ── CATEGORIES ────────────────────────────────────────────────────────────────
router.get(
  "/categories",
  protect,
  tenantMiddleware,
  categoryController.getCategories,
);
router.post(
  "/categories",
  protect,
  tenantMiddleware,
  checkPermission("categories", "new"),
  categoryController.createCategory,
);
router.get(
  "/categories/:id",
  protect,
  tenantMiddleware,
  categoryController.getCategory,
);
router.put(
  "/categories/:id",
  protect,
  tenantMiddleware,
  checkPermission("categories", "edit"),
  categoryController.updateCategory,
);
router.delete(
  "/categories/:id",
  protect,
  tenantMiddleware,
  checkPermission("categories", "delete"),
  categoryController.deleteCategory,
);

// ── SUBCATEGORIES ─────────────────────────────────────────────────────────────
router.get(
  "/sub-categories",
  protect,
  tenantMiddleware,
  categoryController.getSubCategories,
);
router.post(
  "/sub-categories",
  protect,
  tenantMiddleware,
  checkPermission("categories", "new"),
  categoryController.createSubCategory,
);
router.get(
  "/sub-categories/:id",
  protect,
  tenantMiddleware,
  categoryController.getSubCategory,
);
router.put(
  "/sub-categories/:id",
  protect,
  tenantMiddleware,
  checkPermission("categories", "edit"),
  categoryController.updateSubCategory,
);
router.delete(
  "/sub-categories/:id",
  protect,
  tenantMiddleware,
  checkPermission("categories", "delete"),
  categoryController.deleteCategory,
);

// ── Audit log     ─────────────────────────────────────────────────────────────

router.get(
  "/audit-logs",
  protect,
  tenantMiddleware,
  checkPermission("audit_logs", "view"),
  auditLogController.getAuditLogs,
);

router.get(
  "/audit-logs/entity/:entityType/:entityId",
  protect,
  tenantMiddleware,
  checkPermission("audit_logs", "view"),
  auditLogController.getEntityHistory,
);

router.get(
  "/audit-logs/:id/detail",
  protect,
  tenantMiddleware,
  checkPermission("audit_logs", "view"),
  auditLogController.getAuditLogDetail,
);

// ── AMC Service ─────────────────────────────────────────────────────────────

router.get("/amc", protect, tenantMiddleware, amcController.getAllAMC);
router.get(
  "/amc/expiring",
  protect,
  tenantMiddleware,
  amcController.getExpiringAMC,
);

router.get(
  "/amc/asset/:assetId/coverage",
  protect,
  tenantMiddleware,
  amcController.checkAssetCoverage,
);

router.get("/amc/:id", protect, tenantMiddleware, amcController.getByIdAMC);

router.post(
  "/amc",
  protect,
  tenantMiddleware,
  checkPermission("amc", "new"),
  amcController.createAMC,
);

router.put(
  "/amc/:id",
  protect,
  tenantMiddleware,
  checkPermission("amc", "edit"),
  amcController.updateAMC,
);

router.delete(
  "/amc/:id",
  protect,
  tenantMiddleware,
  checkPermission("amc", "edit"),
  amcController.removeAMC,
);

// ── Service visit ─────────────────────────────────────────────────────────────

router.get(
  "/amc/:id/visits",
  protect,
  tenantMiddleware,
  amcController.getAMCVisits,
);
router.post(
  "/amc/:id/visits",
  protect,
  tenantMiddleware,
  checkPermission("amc", "new"),
  amcController.addAMCVisit,
);

// ── Brands ────────────────────────────────────────────────────────────────────
router.get("/brands", protect, tenantMiddleware, brandController.getAllBrands);
router.get(
  "/brands/:id",
  protect,
  tenantMiddleware,
  brandController.getBrandById,
);

router.post(
  "/brands",
  protect,
  tenantMiddleware,
  checkPermission("brands", "new"),
  brandController.createBrand,
);
router.put(
  "/brands/:id",
  protect,
  tenantMiddleware,
  checkPermission("brands", "edit"),
  brandController.updateBrand,
);
router.delete(
  "/brands/:id",
  protect,
  tenantMiddleware,
  checkPermission("brands", "delete"),
  brandController.deleteBrand,
);

// ── Vendors ───────────────────────────────────────────────────────────────────
router.get(
  "/vendors",
  protect,
  tenantMiddleware,
  vendorController.getAllVendors,
);
router.get(
  "/vendors/:id",
  protect,
  tenantMiddleware,
  vendorController.getVendorById,
);

router.post(
  "/vendors",
  protect,
  tenantMiddleware,
  checkPermission("vendors", "new"),
  vendorController.createVendor,
);
router.put(
  "/vendors/:id",
  protect,
  tenantMiddleware,
  checkPermission("vendors", "new"),
  vendorController.updateVendor,
);
router.delete(
  "/vendors/:id",
  protect,
  tenantMiddleware,
  checkPermission("vendors", "new"),
  vendorController.deleteVendor,
);

// ── DEBUG (remove in production) ──────────────────────────────────────────────
router.get(
  "/debug/approval-steps/:requestId",
  protect,
  tenantMiddleware,
  async (req, res) => {
    try {
      const {
        ApprovalRequest,
        ApprovalRequestStep,
      } = require("../models/Approval");
      const User = require("../models/User");
      const request = await ApprovalRequest.findByPk(req.params.requestId, {
        include: [
          {
            model: ApprovalRequestStep,
            include: [
              {
                model: User,
                as: "assignedTo",
                attributes: ["id", "firstName", "lastName", "email"],
              },
            ],
          },
        ],
      });
      res.json({
        request: {
          id: request?.id,
          status: request?.status,
          currentStepOrder: request?.currentStepOrder,
          requestedById: request?.requestedById,
        },
        steps: request?.ApprovalRequestSteps?.map((s) => ({
          stepOrder: s.stepOrder,
          stepName: s.stepName,
          status: s.status,
          assignedToUserId: s.assignedToUserId,
          assignedTo: s.assignedTo,
        })),
        currentUser: {
          id: req.user.id,
          name: `${req.user.firstName} ${req.user.lastName}`,
        },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = router;
