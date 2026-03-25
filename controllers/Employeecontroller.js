const { Op, Sequelize } = require("sequelize");
const Employee = require("../models/Employee");
const Division = require("../models/Division");
const Department = require("../models/Department");
const EmployeeDivision = require("../models/EmployeeDivision");
const Asset = require("../models/Asset");
const { Location } = require("../models/Permission");
const User = require("../models/User");
const { Assignment, AuditLog } = require("../models");
const Category = require("../models/index");

exports.getEmployees = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      departmentId,
      locationId,
      isActive,
      employmentType,
    } = req.query;

    const where = { tenantId: req.user.tenantId };

    if (search) {
      const s = search.replace(/'/g, "''");
      where[Op.or] = [
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { employeeCode: { [Op.like]: `%${search}%` } },
        Sequelize.literal(
          `CONCAT(\`Employee\`.\`firstName\`, ' ', \`Employee\`.\`lastName\`) LIKE '%${s}%'`,
        ),
        Sequelize.literal(
          `CONCAT(\`Employee\`.\`lastName\`, ' ', \`Employee\`.\`firstName\`) LIKE '%${s}%'`,
        ),
      ];
    }

    if (departmentId) where.departmentId = departmentId;
    if (locationId) where.locationId = locationId;
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (employmentType) where.employmentType = employmentType;

    const { count, rows } = await Employee.findAndCountAll({
      where,
      include: [
        {
          model: Department,
          as: "department",
          attributes: ["id", "name", "code"],
        },
        { model: Location, as: "branch", attributes: ["id", "name", "code"] },
        {
          model: Division,
          as: "divisions",
          through: { attributes: ["isPrimary"] },
        },
        {
          model: Employee,
          as: "reportingManager",
          attributes: ["id", "firstName", "lastName", "designation"],
        },
      ],
      order: [["firstName", "ASC"]],
      limit: parseInt(limit),
      offset: (page - 1) * limit,
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET SINGLE EMPLOYEE ──────────────────────────────────────────────────────
exports.getEmployee = async (req, res) => {
  try {
    const employee = await Employee.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId }, // ← ADD tenantId
      include: [
        {
          model: Department,
          as: "department",
          attributes: ["id", "name", "code"],
        },
        { model: Location, as: "branch", attributes: ["id", "name", "code"] },
        {
          model: Division,
          as: "divisions",
          through: { attributes: ["isPrimary"] },
        },
        {
          model: Employee,
          as: "reportingManager",
          attributes: ["id", "firstName", "lastName", "designation"],
        },
        {
          model: Employee,
          as: "subordinates",
          attributes: ["id", "firstName", "lastName", "designation"],
        },
      ],
    });
    if (!employee)
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });

    const assignedAssets = await Asset.findAll({
      where: { assignedToId: req.params.id, tenantId: req.user.tenantId }, // ← ADD tenantId
      attributes: [
        "id",
        "name",
        "assetTag",
        "categoryId",
        "status",
        "currentValue",
      ],
    });

    res.json({ success: true, data: { ...employee.toJSON(), assignedAssets } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── CREATE EMPLOYEE ──────────────────────────────────────────────────────────
exports.createEmployee = async (req, res) => {
  try {
    const existing = await Employee.findOne({
      where: { email: req.body.email, tenantId: req.user.tenantId },
    });
    if (existing)
      return res
        .status(400)
        .json({ success: false, message: "Email already exists" });

    const { divisionIds, ...employeeData } = req.body;

    const employee = await Employee.create({
      ...employeeData,
      tenantId: req.user.tenantId,
    });

    if (divisionIds && divisionIds.length > 0) {
      await EmployeeDivision.bulkCreate(
        divisionIds.map((divisionId, index) => ({
          employeeId: employee.id,
          divisionId,
          tenantId: req.user.tenantId,
          isPrimary: index === 0,
        })),
      );
    }

    const created = await Employee.findByPk(employee.id, {
      include: [
        { model: Department, as: "department", attributes: ["id", "name"] },
        { model: Location, as: "branch", attributes: ["id", "name"] },
        {
          model: Division,
          as: "divisions",
          through: { attributes: ["isPrimary"] },
        },
      ],
    });

    // ── Audit Log ─────────────────────────────────────────────────────────────
    await AuditLog.create({
      entityType: "Employee",
      entityId: employee.id,
      tenantId: req.user.tenantId,
      action: "CREATE",
      userId: req.user.id,
      newValues: created.toJSON(),
      description: `Employee "${employee.firstName} ${employee.lastName}" created`,
    });

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── UPDATE EMPLOYEE ──────────────────────────────────────────────────────────
exports.updateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!employee)
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });

    const oldValues = employee.toJSON();
    const { divisionIds, ...updateData } = req.body;
    await employee.update(updateData);

    if (divisionIds !== undefined) {
      await EmployeeDivision.destroy({
        where: { employeeId: employee.id, tenantId: req.user.tenantId },
      });
      if (divisionIds.length > 0) {
        await EmployeeDivision.bulkCreate(
          divisionIds.map((divisionId, index) => ({
            employeeId: employee.id,
            divisionId,
            tenantId: req.user.tenantId,
            isPrimary: index === 0,
          })),
        );
      }
    }

    const updated = await Employee.findByPk(employee.id, {
      include: [
        { model: Department, as: "department", attributes: ["id", "name"] },
        { model: Location, as: "branch", attributes: ["id", "name"] },
        {
          model: Division,
          as: "divisions",
          through: { attributes: ["isPrimary"] },
        },
      ],
    });

    // ── Audit Log ─────────────────────────────────────────────────────────────
    await AuditLog.create({
      entityType: "Employee",
      entityId: employee.id,
      tenantId: req.user.tenantId,
      action: "UPDATE",
      userId: req.user.id,
      oldValues,
      newValues: updated.toJSON(),
      description: `Employee "${employee.firstName} ${employee.lastName}" updated`,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DELETE EMPLOYEE ──────────────────────────────────────────────────────────
exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!employee)
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });

    const activeAssets = await Asset.count({
      where: { assignedToId: req.params.id, tenantId: req.user.tenantId },
    });
    if (activeAssets > 0)
      return res.status(400).json({
        success: false,
        message: `Cannot deactivate: ${activeAssets} asset(s) still assigned to this employee`,
      });

    const oldValues = employee.toJSON();
    await employee.update({ isActive: false });

    // ── Audit Log ─────────────────────────────────────────────────────────────
    await AuditLog.create({
      entityType: "Employee",
      entityId: employee.id,
      tenantId: req.user.tenantId,
      action: "DEACTIVATE",
      userId: req.user.id,
      oldValues,
      newValues: { isActive: false },
      description: `Employee "${oldValues.firstName} ${oldValues.lastName}" deactivated`,
    });

    res.json({ success: true, message: "Employee deactivated" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── EMPLOYEE ASSET TIMELINE ──────────────────────────────────────────────────
exports.getEmployeeAssetTimeline = async (req, res) => {
  try {
    const employee = await Employee.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId }, // ← ADD tenantId
      include: [
        {
          model: Department,
          as: "department",
          attributes: ["id", "name", "code"],
        },
        { model: Location, as: "branch", attributes: ["id", "name", "code"] },
        {
          model: Division,
          as: "divisions",
          through: { attributes: ["isPrimary"] },
        },
        {
          model: Employee,
          as: "reportingManager",
          attributes: ["id", "firstName", "lastName", "designation"],
        },
      ],
    });

    if (!employee)
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });

    const [assignments, currentAssets, employeeLogs] = await Promise.all([
      Assignment.findAll({
        where: { employeeId: req.params.id, tenantId: req.user.tenantId }, // ← ADD tenantId
        include: [
          {
            model: Asset,
            attributes: [
              "id",
              "name",
              "assetTag",
              "categoryId",
              "status",
              "condition",
              "currentValue",
              "purchaseDate",
            ],
          },
          {
            model: User,
            as: "assignedBy",
            attributes: ["id", "firstName", "lastName", "email"],
          },
          { model: Department, as: "assignedDept", attributes: ["id", "name"] },
          { model: Location, as: "assignedLoc", attributes: ["id", "name"] },
        ],
        order: [["assignedAt", "ASC"]],
      }),

      Asset.findAll({
        where: {
          assignedToId: req.params.id,
          tenantId: req.user.tenantId, // ← ADD tenantId
          assignmentType: "employee",
          status: { [Op.notIn]: ["Disposed"] },
        },
        attributes: [
          "id",
          "name",
          "assetTag",
          "categoryId",
          "status",
          "condition",
          "currentValue",
          "purchaseDate",
        ],
        order: [["name", "ASC"]],
      }),

      AuditLog.findAll({
        where: {
          entityType: "Employee",
          entityId: req.params.id,
          tenantId: req.user.tenantId, // ← ADD tenantId
        },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "firstName", "lastName", "email"],
          },
        ],
        order: [["createdAt", "ASC"]],
      }),
    ]);

    // ── Build timeline events ─────────────────────────────────────────────────
    const events = [];

    const createLog = employeeLogs.find((log) => log.action === "CREATE");
    events.push({
      type: "EMPLOYEE_CREATED",
      icon: "employee",
      color: "#7c3aed",
      date: createLog?.createdAt || employee.createdAt,
      title: "Employee Added / Onboarded",
      details: {
        employeeName: `${employee.firstName} ${employee.lastName}`,
        employeeCode: employee.employeeCode,
        designation: employee.designation,
        department: employee.department?.name || null,
        location: employee.branch?.name || null,
        addedBy: createLog?.User
          ? `${createLog.User.firstName} ${createLog.User.lastName}`
          : "System",
      },
    });

    assignments.forEach((assign, index) => {
      const asset = assign.Asset;
      const assetName = asset
        ? `${asset.name} (${asset.assetTag || "No Tag"})`
        : "Unknown Asset";

      events.push({
        type: index === 0 ? "FIRST_ASSET_ASSIGNED" : "ASSET_ASSIGNED",
        icon: "assign",
        color: "#00d68f",
        date: assign.assignedAt || assign.createdAt,
        title: index === 0 ? "First Asset Assigned" : "Asset Assigned",
        details: {
          assignmentId: assign.id,
          assetId: asset?.id || null,
          assetName,
          assetCategory: asset?.category || null,
          assetStatus: asset?.status || null,
          assetCondition: asset?.condition || null,
          currentValue: asset?.currentValue || null,
          assignedBy: assign.assignedBy
            ? `${assign.assignedBy.firstName} ${assign.assignedBy.lastName}`
            : "System",
          purpose: assign.purpose || null,
          conditionAtAssignment: assign.conditionAtAssignment || null,
        },
      });

      if (assign.returnedAt) {
        events.push({
          type: "ASSET_RETURNED",
          icon: "return",
          color: "#ff8c42",
          date: assign.returnedAt,
          title: "Asset Returned",
          details: {
            assignmentId: assign.id,
            assetId: asset?.id || null,
            assetName,
            returnedAt: assign.returnedAt,
            conditionAtReturn: assign.conditionAtReturn || "Not recorded",
            durationDays: assign.assignedAt
              ? Math.floor(
                  (new Date(assign.returnedAt) - new Date(assign.assignedAt)) /
                    (1000 * 60 * 60 * 24),
                )
              : null,
          },
        });
      } else {
        events.push({
          type: "ASSET_ACTIVE_HOLDING",
          icon: "holding",
          color: "#339af0",
          date: assign.assignedAt || assign.createdAt,
          title: "Currently Holding Asset",
          details: {
            assignmentId: assign.id,
            assetId: asset?.id || null,
            assetName,
            since: assign.assignedAt || assign.createdAt,
            daysHeld: assign.assignedAt
              ? Math.floor(
                  (new Date() - new Date(assign.assignedAt)) /
                    (1000 * 60 * 60 * 24),
                )
              : null,
            conditionAtAssignment: assign.conditionAtAssignment || null,
          },
        });
      }
    });

    const deactivateLog = employeeLogs.find(
      (log) =>
        log.action === "UPDATE" &&
        log.oldValues?.isActive === true &&
        log.newValues?.isActive === false,
    );
    if (deactivateLog || employee.isActive === false) {
      events.push({
        type: "EMPLOYEE_DEACTIVATED",
        icon: "deactivate",
        color: "#ff4757",
        date: deactivateLog?.createdAt || employee.updatedAt,
        title: "Employee Deactivated",
        details: {
          deactivatedBy: deactivateLog?.User
            ? `${deactivateLog.User.firstName} ${deactivateLog.User.lastName}`
            : "System",
        },
      });
    }

    events.sort((a, b) => new Date(a.date) - new Date(b.date));

    const totalAssignments = assignments.length;
    const returnedAssignments = assignments.filter(
      (a) => !!a.returnedAt,
    ).length;
    const activeAssignments = assignments.filter((a) => !a.returnedAt).length;

    const totalDaysAssetsHeld = assignments.reduce((sum, a) => {
      if (!a.assignedAt) return sum;
      const end = a.returnedAt ? new Date(a.returnedAt) : new Date();
      return (
        sum + Math.floor((end - new Date(a.assignedAt)) / (1000 * 60 * 60 * 24))
      );
    }, 0);

    const uniqueAssetIds = [
      ...new Set(assignments.map((a) => a.assetId).filter(Boolean)),
    ];

    res.json({
      success: true,
      data: {
        employee: {
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          fullName: `${employee.firstName} ${employee.lastName}`,
          employeeCode: employee.employeeCode,
          email: employee.email,
          designation: employee.designation,
          employmentType: employee.employmentType,
          isActive: employee.isActive,
          department: employee.department,
          branch: employee.branch,
          divisions: employee.divisions,
          reportingManager: employee.reportingManager,
          createdAt: employee.createdAt,
        },
        timeline: events,
        currentAssets,
        summary: {
          totalEvents: events.length,
          totalAssignments,
          returnedAssignments,
          activeAssignments,
          uniqueAssetsHandled: uniqueAssetIds.length,
          currentlyAssignedAssets: currentAssets.length,
          totalDaysAssetsHeld,
          employeeStatus: employee.isActive ? "Active" : "Inactive",
          department: employee.department?.name || null,
          location: employee.branch?.name || null,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
