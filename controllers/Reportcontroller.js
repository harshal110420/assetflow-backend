// ─── reportController.js ─────────────────────────────────────────────────────
// All alias errors fixed:
// ✅ Employee → Location: as "branch" (not "location")
// ✅ Department → Location: REMOVED (no association exists)
// ✅ Category → Asset: as "categoryAssets" (not "assets")
// ✅ SubCategory → Asset: as "subCategoryAssets" (already correct)
// ─────────────────────────────────────────────────────────────────────────────

const { Op } = require("sequelize");
const Asset = require("../models/Asset");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Department = require("../models/Department");
const Division = require("../models/Division");
const {
  AuditLog,
  Assignment,
  Maintenance,
  Category,
  SubCategory,
} = require("../models/index");
const { Location } = require("../models/Permission");

// ── Helper: date range ────────────────────────────────────────────────────────
const dateRange = (from, to, field = "createdAt") => {
  const where = {};
  if (from || to) {
    where[field] = {};
    if (from) where[field][Op.gte] = new Date(from);
    if (to)
      where[field][Op.lte] = new Date(new Date(to).setHours(23, 59, 59, 999));
  }
  return where;
};

// ── Shared asset includes ─────────────────────────────────────────────────────
const reportAssetIncludes = () => [
  {
    model: Employee,
    as: "assignedToEmployee",
    required: false,
    attributes: ["id", "firstName", "lastName", "email", "designation"],
    include: [
      { model: Department, as: "department", attributes: ["id", "name"] },
    ],
  },
  {
    model: Department,
    as: "department",
    attributes: ["id", "name"],
    required: false,
  },
  {
    model: Location,
    as: "locationObj",
    attributes: ["id", "name", "code"],
    required: false,
  },
  {
    model: Category,
    as: "category",
    attributes: ["id", "name", "icon", "color"],
    required: false,
  },
  {
    model: SubCategory,
    as: "subCategory",
    attributes: ["id", "name"],
    required: false,
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// 1. ASSET REPORT
// ═════════════════════════════════════════════════════════════════════════════
exports.getAssetReport = async (req, res) => {
  try {
    const { from, to, categoryId, status, condition, location, departmentId } =
      req.query;
    const where = {
      tenantId: req.user.tenantId,
      ...dateRange(from, to, "createdAt"),
    };
    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;
    if (condition) where.condition = condition;
    if (location) where.locationId = location;
    if (departmentId) where.departmentId = departmentId;

    const assets = await Asset.findAll({
      where,
      include: reportAssetIncludes(),
      order: [["createdAt", "DESC"]],
    });

    const summary = {
      total: assets.length,
      totalValue: 0,
      byStatus: {},
      byCategory: {},
    };
    assets.forEach((a) => {
      summary.totalValue += parseFloat(a.currentValue || 0);
      const cat = a.category?.name || "Uncategorized";
      summary.byStatus[a.status] = (summary.byStatus[a.status] || 0) + 1;
      summary.byCategory[cat] = (summary.byCategory[cat] || 0) + 1;
    });

    res.json({ success: true, data: assets, summary, count: assets.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// 2. MAINTENANCE REPORT
// ═════════════════════════════════════════════════════════════════════════════
exports.getMaintenanceReport = async (req, res) => {
  try {
    const { from, to, status, type, priority } = req.query;
    const where = {
      tenantId: req.user.tenantId,
      ...dateRange(from, to, "createdAt"),
    };
    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;

    const records = await Maintenance.findAll({
      where,
      include: [
        {
          model: Asset,
          attributes: ["id", "name", "assetTag"],
          include: [
            {
              model: Category,
              as: "category",
              attributes: ["id", "name"],
              required: false,
            },
            {
              model: SubCategory,
              as: "subCategory",
              attributes: ["id", "name"],
              required: false,
            },
          ],
        },
        {
          model: Employee,
          as: "technician",
          attributes: ["id", "firstName", "lastName", "email", "designation"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const summary = {
      total: records.length,
      totalCost: 0,
      byStatus: {},
      byType: {},
      byPriority: {},
    };
    records.forEach((r) => {
      summary.totalCost += parseFloat(r.cost || 0);
      summary.byStatus[r.status] = (summary.byStatus[r.status] || 0) + 1;
      summary.byType[r.type] = (summary.byType[r.type] || 0) + 1;
      summary.byPriority[r.priority] =
        (summary.byPriority[r.priority] || 0) + 1;
    });

    res.json({ success: true, data: records, summary, count: records.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// 3. ASSIGNMENT REPORT
// ═════════════════════════════════════════════════════════════════════════════
exports.getAssignmentReport = async (req, res) => {
  try {
    const { from, to, employeeId, isActive } = req.query;
    const where = {
      tenantId: req.user.tenantId,
      ...dateRange(from, to, "assignedAt"),
    };
    if (employeeId) where.employeeId = employeeId;
    if (isActive !== undefined && isActive !== "")
      where.isActive = isActive === "true";

    const assignments = await Assignment.findAll({
      where,
      include: [
        {
          model: Asset,
          attributes: ["id", "name", "assetTag", "currentValue", "status"],
          include: [
            {
              model: Category,
              as: "category",
              attributes: ["id", "name"],
              required: false,
            },
            {
              model: SubCategory,
              as: "subCategory",
              attributes: ["id", "name"],
              required: false,
            },
          ],
        },
        {
          model: Employee,
          as: "assignedEmployee",
          required: false,
          attributes: ["id", "firstName", "lastName", "email", "designation"],
          include: [
            { model: Department, as: "department", attributes: ["id", "name"] },
          ],
        },
        {
          model: User,
          as: "assignedBy",
          attributes: ["id", "firstName", "lastName"],
          required: false,
        },
      ],
      order: [["assignedAt", "DESC"]],
    });

    const summary = {
      total: assignments.length,
      active: assignments.filter((a) => a.isActive).length,
      returned: assignments.filter((a) => !a.isActive).length,
      totalValue: assignments
        .filter((a) => a.isActive)
        .reduce((s, a) => s + parseFloat(a.Asset?.currentValue || 0), 0),
    };

    res.json({
      success: true,
      data: assignments,
      summary,
      count: assignments.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// 4. WARRANTY EXPIRY REPORT
// ═════════════════════════════════════════════════════════════════════════════
exports.getWarrantyReport = async (req, res) => {
  try {
    const { from, to, categoryId, status, expiring } = req.query;
    const where = {
      tenantId: req.user.tenantId,
      warrantyExpiry: { [Op.ne]: null },
    };

    if (from || to) {
      where.warrantyExpiry = {};
      if (from) where.warrantyExpiry[Op.gte] = new Date(from);
      if (to) where.warrantyExpiry[Op.lte] = new Date(to);
    } else if (expiring) {
      const days = parseInt(expiring) || 90;
      const today = new Date(),
        future = new Date();
      future.setDate(future.getDate() + days);
      where.warrantyExpiry = { [Op.between]: [today, future] };
    }
    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;

    const assets = await Asset.findAll({
      where,
      include: [
        {
          model: Employee,
          as: "assignedToEmployee",
          attributes: ["id", "firstName", "lastName", "designation"],
          required: false,
        },
        {
          model: Category,
          as: "category",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: SubCategory,
          as: "subCategory",
          attributes: ["id", "name"],
          required: false,
        },
      ],
      order: [["warrantyExpiry", "ASC"]],
    });

    const today = new Date();
    const summary = {
      total: assets.length,
      expired: assets.filter((a) => new Date(a.warrantyExpiry) < today).length,
      expiring30: assets.filter((a) => {
        const d = new Date(a.warrantyExpiry);
        return d >= today && d <= new Date(today.getTime() + 30 * 86400000);
      }).length,
      expiring90: assets.filter((a) => {
        const d = new Date(a.warrantyExpiry);
        return d >= today && d <= new Date(today.getTime() + 90 * 86400000);
      }).length,
    };

    res.json({ success: true, data: assets, summary, count: assets.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// 5. DEPRECIATION REPORT
// ═════════════════════════════════════════════════════════════════════════════
exports.getDepreciationReport = async (req, res) => {
  try {
    const { categoryId, status, from, to } = req.query;
    const where = {
      tenantId: req.user.tenantId,
      purchasePrice: { [Op.ne]: null, [Op.gt]: 0 },
      ...dateRange(from, to, "purchaseDate"),
    };
    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;

    const assets = await Asset.findAll({
      where,
      include: [
        {
          model: Employee,
          as: "assignedToEmployee",
          attributes: ["id", "firstName", "lastName", "designation"],
          required: false,
        },
        {
          model: Category,
          as: "category",
          attributes: ["id", "name", "depreciationRate"],
          required: false,
        },
        {
          model: SubCategory,
          as: "subCategory",
          attributes: ["id", "name"],
          required: false,
        },
      ],
      order: [["purchaseDate", "ASC"]],
    });

    const data = assets.map((a) => {
      const purchasePrice = parseFloat(a.purchasePrice || 0);
      const currentValue = parseFloat(a.currentValue || 0);
      const depreciationAmt = purchasePrice - currentValue;
      const depreciationPct =
        purchasePrice > 0
          ? ((depreciationAmt / purchasePrice) * 100).toFixed(1)
          : 0;
      const ageYears = a.purchaseDate
        ? (
            (new Date() - new Date(a.purchaseDate)) /
            (365.25 * 86400000)
          ).toFixed(1)
        : null;
      return { ...a.toJSON(), depreciationAmt, depreciationPct, ageYears };
    });

    const summary = {
      total: data.length,
      totalPurchaseValue: data.reduce(
        (s, a) => s + parseFloat(a.purchasePrice || 0),
        0,
      ),
      totalCurrentValue: data.reduce(
        (s, a) => s + parseFloat(a.currentValue || 0),
        0,
      ),
      totalDepreciation: data.reduce((s, a) => s + (a.depreciationAmt || 0), 0),
    };

    res.json({ success: true, data, summary, count: data.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// 6. EMPLOYEE-WISE REPORT
// ✅ Fixed: Employee → Location alias is "branch" not "location"
// ═════════════════════════════════════════════════════════════════════════════
exports.getEmployeeWiseReport = async (req, res) => {
  try {
    const { departmentId, divisionId, employeeId, from, to, showHistory } =
      req.query;
    const tenantId = req.user.tenantId;

    const empWhere = { tenantId, isActive: true };
    if (employeeId) empWhere.id = employeeId;
    if (departmentId) empWhere.departmentId = departmentId;

    if (divisionId) {
      const depts = await Department.findAll({
        where: { divisionId, tenantId },
        attributes: ["id"],
      });
      empWhere.departmentId = { [Op.in]: depts.map((d) => d.id) };
    }

    const employees = await Employee.findAll({
      where: empWhere,
      attributes: [
        "id",
        "firstName",
        "lastName",
        "email",
        "employeeCode",
        "designation",
        "departmentId",
        "locationId",
      ],
      include: [
        {
          model: Department,
          as: "department",
          attributes: ["id", "name", "code"],
          include: [
            {
              model: Division,
              as: "division",
              attributes: ["id", "name", "code"],
            },
          ],
        },
        // ✅ FIXED: as "branch" not "location"
        {
          model: Location,
          as: "branch",
          attributes: ["id", "name", "code"],
          required: false,
        },
      ],
      order: [["firstName", "ASC"]],
    });

    const assignWhere = { tenantId };
    if (showHistory !== "true") assignWhere.isActive = true;
    if (from || to)
      Object.assign(assignWhere, dateRange(from, to, "assignedAt"));

    const employeeIds = employees.map((e) => e.id);
    if (employeeIds.length === 0)
      return res.json({
        success: true,
        data: [],
        summary: {
          totalEmployees: 0,
          totalAssets: 0,
          totalCurrentAssets: 0,
          totalValue: 0,
        },
        count: 0,
      });

    const assignments = await Assignment.findAll({
      where: { ...assignWhere, employeeId: { [Op.in]: employeeIds } },
      include: [
        {
          model: Asset,
          attributes: [
            "id",
            "name",
            "assetTag",
            "status",
            "condition",
            "currentValue",
            "purchasePrice",
            "purchaseDate",
            "serialNumber",
            "brand",
            "model",
          ],
          include: [
            {
              model: Category,
              as: "category",
              attributes: ["id", "name"],
              required: false,
            },
            {
              model: SubCategory,
              as: "subCategory",
              attributes: ["id", "name"],
              required: false,
            },
          ],
        },
      ],
      order: [["assignedAt", "DESC"]],
    });

    const assignmentsByEmployee = {};
    assignments.forEach((a) => {
      if (!assignmentsByEmployee[a.employeeId])
        assignmentsByEmployee[a.employeeId] = [];
      assignmentsByEmployee[a.employeeId].push(a);
    });

    const data = employees
      .map((emp) => {
        const empAssignments = assignmentsByEmployee[emp.id] || [];
        const currentAssets = empAssignments.filter((a) => a.isActive);
        const pastAssets = empAssignments.filter((a) => !a.isActive);
        const currentValue = currentAssets.reduce(
          (s, a) => s + parseFloat(a.Asset?.currentValue || 0),
          0,
        );

        return {
          id: emp.id,
          firstName: emp.firstName,
          lastName: emp.lastName,
          email: emp.email,
          employeeCode: emp.employeeCode,
          designation: emp.designation,
          department: emp.department,
          division: emp.department?.division,
          // ✅ FIXED: emp.branch not emp.location
          location: emp.branch,

          totalAssignments: empAssignments.length,
          currentAssetCount: currentAssets.length,
          pastAssetCount: pastAssets.length,
          currentValue,

          currentAssets: currentAssets.map((a) => ({
            assetId: a.Asset?.id,
            assetTag: a.Asset?.assetTag,
            name: a.Asset?.name,
            category: a.Asset?.category?.name,
            subCategory: a.Asset?.subCategory?.name,
            brand: a.Asset?.brand,
            model: a.Asset?.model,
            serialNumber: a.Asset?.serialNumber,
            status: a.Asset?.status,
            condition: a.Asset?.condition,
            currentValue: a.Asset?.currentValue,
            assignedAt: a.assignedAt,
            purpose: a.purpose,
            conditionAtAssignment: a.conditionAtAssignment,
          })),

          pastAssets:
            showHistory === "true"
              ? pastAssets.map((a) => ({
                  assetId: a.Asset?.id,
                  assetTag: a.Asset?.assetTag,
                  name: a.Asset?.name,
                  category: a.Asset?.category?.name,
                  assignedAt: a.assignedAt,
                  returnedAt: a.returnedAt,
                  conditionAtAssignment: a.conditionAtAssignment,
                  conditionAtReturn: a.conditionAtReturn,
                }))
              : [],
        };
      })
      .filter((e) => e.totalAssignments > 0 || showHistory === "true");

    const summary = {
      totalEmployees: data.length,
      totalAssets: data.reduce((s, e) => s + e.totalAssignments, 0),
      totalCurrentAssets: data.reduce((s, e) => s + e.currentAssetCount, 0),
      totalValue: data.reduce((s, e) => s + e.currentValue, 0),
    };

    res.json({ success: true, data, summary, count: data.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// 7. CATEGORY-WISE REPORT
// ✅ Fixed: Category → Asset alias is "categoryAssets" not "assets"
// ✅ Already correct: SubCategory → Asset alias is "subCategoryAssets"
// ═════════════════════════════════════════════════════════════════════════════
exports.getCategoryWiseReport = async (req, res) => {
  try {
    const { status } = req.query;
    const tenantId = req.user.tenantId;
    const assetWhere = { tenantId };
    if (status) assetWhere.status = status;

    const categories = await Category.findAll({
      where: { tenantId, isActive: true },
      attributes: ["id", "name", "icon", "color", "depreciationRate"],
      include: [
        {
          model: SubCategory,
          as: "subCategories",
          where: { isActive: true, tenantId },
          required: false,
          attributes: ["id", "name"],
          include: [
            {
              // ✅ CORRECT: "subCategoryAssets"
              model: Asset,
              as: "subCategoryAssets",
              where: assetWhere,
              required: false,
              attributes: [
                "id",
                "name",
                "assetTag",
                "status",
                "currentValue",
                "purchasePrice",
                "condition",
              ],
            },
          ],
        },
        {
          // ✅ FIXED: "categoryAssets" not "assets"
          model: Asset,
          as: "categoryAssets",
          where: assetWhere,
          required: false,
          attributes: [
            "id",
            "name",
            "assetTag",
            "status",
            "currentValue",
            "purchasePrice",
            "condition",
            "subCategoryId",
          ],
        },
      ],
      order: [["name", "ASC"]],
    });

    const data = categories
      .map((cat) => {
        // ✅ FIXED: cat.categoryAssets not cat.assets
        const allAssets = cat.categoryAssets || [];
        const totalAssets = allAssets.length;
        const totalValue = allAssets.reduce(
          (s, a) => s + parseFloat(a.currentValue || 0),
          0,
        );
        const totalPurchaseValue = allAssets.reduce(
          (s, a) => s + parseFloat(a.purchasePrice || 0),
          0,
        );

        const byStatus = {};
        allAssets.forEach((a) => {
          byStatus[a.status] = (byStatus[a.status] || 0) + 1;
        });

        const subCategoryBreakdown = (cat.subCategories || []).map((sub) => ({
          id: sub.id,
          name: sub.name,
          // ✅ CORRECT: sub.subCategoryAssets
          assetCount: (sub.subCategoryAssets || []).length,
          totalValue: (sub.subCategoryAssets || []).reduce(
            (s, a) => s + parseFloat(a.currentValue || 0),
            0,
          ),
        }));

        return {
          id: cat.id,
          name: cat.name,
          icon: cat.icon,
          color: cat.color,
          depreciationRate: cat.depreciationRate,
          totalAssets,
          totalValue,
          totalPurchaseValue,
          totalDepreciation: totalPurchaseValue - totalValue,
          byStatus,
          subCategoryBreakdown,
        };
      })
      .filter((c) => c.totalAssets > 0);

    const summary = {
      totalCategories: data.length,
      totalAssets: data.reduce((s, c) => s + c.totalAssets, 0),
      totalValue: data.reduce((s, c) => s + c.totalValue, 0),
    };

    res.json({ success: true, data, summary, count: data.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// 8. LOCATION-WISE REPORT
// Uses reverse approach — no Location → Asset include (avoids alias ambiguity)
// ═════════════════════════════════════════════════════════════════════════════
exports.getLocationWiseReport = async (req, res) => {
  try {
    const { status, categoryId } = req.query;
    const tenantId = req.user.tenantId;

    const assetWhere = { tenantId, locationId: { [Op.ne]: null } };
    if (status) assetWhere.status = status;
    if (categoryId) assetWhere.categoryId = categoryId;

    const locations = await Location.findAll({
      where: { tenantId, isActive: true },
      attributes: ["id", "name", "code", "address"],
      order: [["name", "ASC"]],
    });

    const assets = await Asset.findAll({
      where: assetWhere,
      attributes: [
        "id",
        "name",
        "assetTag",
        "status",
        "currentValue",
        "condition",
        "locationId",
      ],
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "name"],
          required: false,
        },
      ],
    });

    const assetsByLocation = {};
    assets.forEach((a) => {
      if (!assetsByLocation[a.locationId]) assetsByLocation[a.locationId] = [];
      assetsByLocation[a.locationId].push(a);
    });

    const data = locations
      .map((loc) => {
        const locAssets = assetsByLocation[loc.id] || [];
        const byStatus = {};
        const byCategory = {};
        locAssets.forEach((a) => {
          byStatus[a.status] = (byStatus[a.status] || 0) + 1;
          const cat = a.category?.name || "Uncategorized";
          byCategory[cat] = (byCategory[cat] || 0) + 1;
        });
        return {
          id: loc.id,
          name: loc.name,
          code: loc.code,
          address: loc.address,
          totalAssets: locAssets.length,
          totalValue: locAssets.reduce(
            (s, a) => s + parseFloat(a.currentValue || 0),
            0,
          ),
          byStatus,
          byCategory,
        };
      })
      .filter((l) => l.totalAssets > 0);

    const summary = {
      totalLocations: data.length,
      totalAssets: data.reduce((s, l) => s + l.totalAssets, 0),
      totalValue: data.reduce((s, l) => s + l.totalValue, 0),
    };

    res.json({ success: true, data, summary, count: data.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// 9. CONFIGURATION REPORT
// ═════════════════════════════════════════════════════════════════════════════
exports.getConfigurationReport = async (req, res) => {
  try {
    const { categoryId, configKey, assignmentType } = req.query;
    const tenantId = req.user.tenantId;

    const where = { tenantId, customFields: { [Op.ne]: null } };
    if (categoryId) where.categoryId = categoryId;
    if (assignmentType) where.assignmentType = assignmentType;

    const assets = await Asset.findAll({
      where,
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: SubCategory,
          as: "subCategory",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: Employee,
          as: "assignedToEmployee",
          attributes: ["id", "firstName", "lastName", "designation"],
          required: false,
        },
        {
          model: Department,
          as: "department",
          attributes: ["id", "name"],
          required: false,
        },
      ],
      order: [["name", "ASC"]],
    });

    const data = assets
      .map((a) => {
        let config = a.customFields;
        if (typeof config === "string") {
          try {
            config = JSON.parse(config);
          } catch {
            config = {};
          }
        }
        if (!config || Object.keys(config).length === 0) return null;
        if (
          configKey &&
          !Object.keys(config).some((k) =>
            k.toLowerCase().includes(configKey.toLowerCase()),
          )
        )
          return null;
        return {
          ...a.toJSON(),
          configFields: Object.entries(config).map(([key, value]) => ({
            key,
            value: String(value),
          })),
        };
      })
      .filter(Boolean);

    const allConfigKeys = [
      ...new Set(data.flatMap((a) => a.configFields.map((f) => f.key))),
    ].sort();

    const summary = {
      totalAssets: data.length,
      uniqueConfigKeys: allConfigKeys.length,
      configKeySummary: allConfigKeys.reduce((acc, key) => {
        acc[key] = data.filter((a) =>
          a.configFields.some((f) => f.key === key),
        ).length;
        return acc;
      }, {}),
    };

    res.json({
      success: true,
      data,
      summary,
      allConfigKeys,
      count: data.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// 10. ASSIGNMENT HISTORY WITH CONFIG SNAPSHOT
// ═════════════════════════════════════════════════════════════════════════════
exports.getAssignmentHistoryReport = async (req, res) => {
  try {
    const { from, to, employeeId, assetId, departmentId } = req.query;
    const tenantId = req.user.tenantId;

    const where = { tenantId, ...dateRange(from, to, "assignedAt") };
    if (employeeId) where.employeeId = employeeId;
    if (assetId) where.assetId = assetId;

    const assignments = await Assignment.findAll({
      where,
      include: [
        {
          model: Asset,
          attributes: ["id", "name", "assetTag", "status", "currentValue"],
          include: [
            {
              model: Category,
              as: "category",
              attributes: ["id", "name"],
              required: false,
            },
            {
              model: SubCategory,
              as: "subCategory",
              attributes: ["id", "name"],
              required: false,
            },
          ],
        },
        {
          model: Employee,
          as: "assignedEmployee",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "employeeCode",
            "designation",
          ],
          include: [
            {
              model: Department,
              as: "department",
              attributes: ["id", "name"],
              ...(departmentId ? { where: { id: departmentId } } : {}),
            },
          ],
          required: !!departmentId,
        },
        {
          model: User,
          as: "assignedBy",
          attributes: ["id", "firstName", "lastName"],
          required: false,
        },
      ],
      order: [["assignedAt", "DESC"]],
    });

    const data = assignments.map((a) => {
      const raw = a.configSnapshot;
      let configFields = [];
      if (raw) {
        try {
          const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
          configFields = Array.isArray(parsed)
            ? parsed
            : Object.entries(parsed).map(([key, value]) => ({
                key,
                value: String(value),
              }));
        } catch {
          configFields = [];
        }
      }
      return { ...a.toJSON(), configFields };
    });

    const summary = {
      total: data.length,
      active: data.filter((a) => a.isActive).length,
      returned: data.filter((a) => !a.isActive).length,
      withConfig: data.filter((a) => a.configFields.length > 0).length,
    };

    res.json({ success: true, data, summary, count: data.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// 11. DEPARTMENT-WISE REPORT
// ✅ Fixed: Department → Location REMOVED (no association in models/index.js)
//    location: null returned instead
// ═════════════════════════════════════════════════════════════════════════════
exports.getDepartmentWiseReport = async (req, res) => {
  try {
    const { divisionId, departmentId, from, to, status, categoryId } =
      req.query;
    const tenantId = req.user.tenantId;

    const divWhere = { tenantId, isActive: true };
    if (divisionId) divWhere.id = divisionId;

    const divisions = await Division.findAll({
      where: divWhere,
      attributes: ["id", "name", "code"],
      include: [
        {
          model: Department,
          as: "departments",
          where: {
            tenantId,
            isActive: true,
            ...(departmentId ? { id: departmentId } : {}),
          },
          required: false,
          attributes: ["id", "name", "code"],
          // ✅ FIXED: Location include REMOVED — Department has no locationId FK
        },
      ],
      order: [["name", "ASC"]],
    });

    const assetWhere = { tenantId };
    if (status) assetWhere.status = status;
    if (categoryId) assetWhere.categoryId = categoryId;
    if (from || to) Object.assign(assetWhere, dateRange(from, to, "createdAt"));

    const allDeptIds = divisions.flatMap((div) =>
      (div.departments || []).map((d) => d.id),
    );
    if (allDeptIds.length === 0)
      return res.json({
        success: true,
        data: [],
        summary: {
          totalDivisions: 0,
          totalDepartments: 0,
          totalAssets: 0,
          totalValue: 0,
        },
        count: 0,
      });

    // Direct dept assets
    const directAssets = await Asset.findAll({
      where: {
        ...assetWhere,
        assignmentType: "department",
        assignedToDeptId: { [Op.in]: allDeptIds },
      },
      attributes: [
        "id",
        "name",
        "assetTag",
        "status",
        "condition",
        "currentValue",
        "purchasePrice",
        "assignedToDeptId",
      ],
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: SubCategory,
          as: "subCategory",
          attributes: ["id", "name"],
          required: false,
        },
      ],
    });

    // Employees in those depts
    const employees = await Employee.findAll({
      where: {
        tenantId,
        isActive: true,
        departmentId: { [Op.in]: allDeptIds },
      },
      attributes: [
        "id",
        "firstName",
        "lastName",
        "employeeCode",
        "designation",
        "departmentId",
      ],
    });
    const empIds = employees.map((e) => e.id);
    const empMap = {};
    employees.forEach((e) => {
      empMap[e.id] = e;
    });

    // Active employee assignments
    const empAssignments =
      empIds.length > 0
        ? await Assignment.findAll({
            where: {
              tenantId,
              isActive: true,
              employeeId: { [Op.in]: empIds },
              ...(from || to ? dateRange(from, to, "assignedAt") : {}),
            },
            include: [
              {
                model: Asset,
                where: assetWhere,
                required: true,
                attributes: [
                  "id",
                  "name",
                  "assetTag",
                  "status",
                  "condition",
                  "currentValue",
                  "purchasePrice",
                ],
                include: [
                  {
                    model: Category,
                    as: "category",
                    attributes: ["id", "name"],
                    required: false,
                  },
                  {
                    model: SubCategory,
                    as: "subCategory",
                    attributes: ["id", "name"],
                    required: false,
                  },
                ],
              },
            ],
          })
        : [];

    // Group by dept
    const directByDept = {};
    const empAssetsByDept = {};

    directAssets.forEach((a) => {
      if (!directByDept[a.assignedToDeptId])
        directByDept[a.assignedToDeptId] = [];
      directByDept[a.assignedToDeptId].push(a);
    });

    empAssignments.forEach((a) => {
      const emp = empMap[a.employeeId];
      if (!emp) return;
      const dId = emp.departmentId;
      if (!empAssetsByDept[dId]) empAssetsByDept[dId] = [];
      empAssetsByDept[dId].push({
        ...a.Asset.toJSON(),
        assignedTo: `${emp.firstName} ${emp.lastName}`,
        employeeCode: emp.employeeCode,
        designation: emp.designation,
        assignedAt: a.assignedAt,
      });
    });

    const data = divisions
      .map((div) => {
        const depts = (div.departments || []).map((dept) => {
          const direct = directByDept[dept.id] || [];
          const empAssets = empAssetsByDept[dept.id] || [];
          const allAssets = [...direct, ...empAssets];

          const byStatus = {};
          const byCategory = {};
          allAssets.forEach((a) => {
            byStatus[a.status] = (byStatus[a.status] || 0) + 1;
            const cat = a.category?.name || "Uncategorized";
            byCategory[cat] = (byCategory[cat] || 0) + 1;
          });

          return {
            id: dept.id,
            name: dept.name,
            code: dept.code,
            location: null, // ✅ Department has no Location association
            totalAssets: allAssets.length,
            directAssets: direct.length,
            employeeAssets: empAssets.length,
            totalValue: allAssets.reduce(
              (s, a) => s + parseFloat(a.currentValue || 0),
              0,
            ),
            byStatus,
            byCategory,
            employeeCount: employees.filter((e) => e.departmentId === dept.id)
              .length,
            directAssetList: direct.map((a) => ({
              assetTag: a.assetTag,
              name: a.name,
              category: a.category?.name,
              status: a.status,
              condition: a.condition,
              currentValue: a.currentValue,
            })),
            employeeAssetList: empAssets.map((a) => ({
              assetTag: a.assetTag,
              name: a.name,
              category: a.category?.name,
              assignedTo: a.assignedTo,
              employeeCode: a.employeeCode,
              designation: a.designation,
              status: a.status,
              currentValue: a.currentValue,
              assignedAt: a.assignedAt,
            })),
          };
        });

        return {
          id: div.id,
          name: div.name,
          code: div.code,
          totalAssets: depts.reduce((s, d) => s + d.totalAssets, 0),
          totalValue: depts.reduce((s, d) => s + d.totalValue, 0),
          departmentCount: depts.length,
          departments: depts,
        };
      })
      .filter((div) => div.departments.length > 0);

    const summary = {
      totalDivisions: data.length,
      totalDepartments: data.reduce((s, d) => s + d.departmentCount, 0),
      totalAssets: data.reduce((s, d) => s + d.totalAssets, 0),
      totalValue: data.reduce((s, d) => s + d.totalValue, 0),
    };

    res.json({ success: true, data, summary, count: data.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
