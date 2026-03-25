const { Op } = require("sequelize");
const Asset = require("../models/Asset");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Department = require("../models/Department");
const {
  AuditLog,
  Assignment,
  Maintenance,
  Category,
  SubCategory,
} = require("../models/index");
const { Location, UserLocation } = require("../models/Permission");
const { ApprovalRequest, ApprovalRequestStep } = require("../models/Approval");
const QRCode = require("qrcode");
const approvalEngine = require("../services/approvalEngine");
const socketService = require("../socket");

const generateAssetTag = () =>
  `AST-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

async function resolveLocationId(locationName, tenantId) {
  if (!locationName) return null;
  const loc = await Location.findOne({
    where: { name: locationName, tenantId }, // ← ADD tenantId
  });
  return loc ? loc.id : null;
}

const assetIncludes = () => [
  {
    model: Employee,
    as: "assignedToEmployee",
    attributes: [
      "id",
      "firstName",
      "lastName",
      "email",
      "designation",
      "employeeCode",
    ],
  },
  {
    model: Department,
    as: "assignedToDept",
    attributes: ["id", "name", "code"],
  },
  { model: Location, as: "assignedToLoc", attributes: ["id", "name", "code"] },
  { model: User, as: "createdBy", attributes: ["id", "firstName", "lastName"] },
  { model: Location, as: "locationObj", attributes: ["id", "name", "code"] },
  { model: Department, as: "department", attributes: ["id", "name"] },
  {
    model: Category,
    as: "category",
    attributes: ["id", "name", "icon", "color", "depreciationRate"],
  },
  {
    model: SubCategory,
    as: "subCategory",
    attributes: ["id", "name", "depreciationRate"],
  },
  {
    model: ApprovalRequest,
    as: "approvalRequests",
    where: { module: "asset_assignment" },
    required: false,
    separate: true,
    order: [["createdAt", "DESC"]],
    limit: 1,
    attributes: ["id", "status", "module", "createdAt"],
  },
  {
    model: Assignment,
    where: { isActive: true },
    required: false, // LEFT JOIN — assignment na ho tab bhi asset aaye
    attributes: [
      "id",
      "assignmentType",
      "employeeId",
      "departmentId",
      "locationId",
      "assignedAt",
    ],
  },
];

const getAssignedToLabel = (asset) => {
  switch (asset.assignmentType) {
    case "employee":
      return asset.assignedToEmployee
        ? `${asset.assignedToEmployee.firstName} ${asset.assignedToEmployee.lastName}`
        : null;
    case "department":
      return asset.assignedToDept?.name || null;
    case "location":
      return asset.assignedToLoc?.name || null;
    case "pool":
      return "Pool (Available)";
    default:
      return null;
  }
};

const clearAssignmentFKs = () => ({
  assignedToId: null,
  assignedToDeptId: null,
  assignedToLocId: null,
});

// ─── GET ASSETS ───────────────────────────────────────────────────────────────
exports.getAssets = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      categoryId,
      subCategoryId,
      status,
      departmentId,
      condition,
      assignmentType,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;

    const where = { tenantId: req.user.tenantId }; // ← already done, keeping

    if (search)
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { assetTag: { [Op.like]: `%${search}%` } },
        { serialNumber: { [Op.like]: `%${search}%` } },
        { brand: { [Op.like]: `%${search}%` } },
      ];
    if (categoryId) where.categoryId = categoryId;
    if (subCategoryId) where.subCategoryId = subCategoryId;
    if (status) where.status = status;
    if (departmentId) where.departmentId = departmentId;
    if (condition) where.condition = condition;
    if (assignmentType) where.assignmentType = assignmentType;

    if (req.user.role !== "admin" && req.user.role !== "manager") {
      const userLocs = await UserLocation.findAll({
        where: { userId: req.user.id, tenantId: req.user.tenantId }, // ← ADD tenantId
        attributes: ["locationId"],
      });
      where.locationId =
        userLocs.length > 0
          ? { [Op.in]: userLocs.map((l) => l.locationId) }
          : null;
    }

    const { count, rows } = await Asset.findAndCountAll({
      where,
      include: assetIncludes(),
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset: (page - 1) * parseInt(limit),
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET SINGLE ASSET ─────────────────────────────────────────────────────────
exports.getAsset = async (req, res) => {
  try {
    const asset = await Asset.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId }, // ← ADD tenantId
      include: assetIncludes(),
    });
    if (!asset)
      return res
        .status(404)
        .json({ success: false, message: "Asset not found" });
    res.json({ success: true, data: asset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── CREATE ASSET ─────────────────────────────────────────────────────────────
exports.createAsset = async (req, res) => {
  try {
    const assetTag = req.body.assetTag || generateAssetTag();
    const qrCode = await QRCode.toDataURL(
      `${process.env.FRONTEND_URL || "http://localhost:5000"}/scan/${assetTag}`,
      { errorCorrectionLevel: "M", margin: 1, width: 300 },
    );
    const locationId =
      req.body.locationId ||
      (await resolveLocationId(req.body.location, req.user.tenantId)); // ← ADD tenantId

    const asset = await Asset.create({
      ...req.body,
      assetTag,
      qrCode,
      tenantId: req.user.tenantId, // ← ADD
      createdById: req.user.id,
      locationId,
      assignmentType: "pool",
      assignedToId: null,
      assignedToDeptId: null,
      assignedToLocId: null,
    });

    await AuditLog.create({
      entityType: "Asset",
      entityId: asset.id,
      tenantId: req.user.tenantId, // ← ADD
      action: "CREATE",
      userId: req.user.id,
      newValues: asset.toJSON(),
      description: `Asset ${assetTag} created`,
    });

    res.status(201).json({ success: true, data: asset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── UPDATE ASSET ─────────────────────────────────────────────────────────────
exports.updateAsset = async (req, res) => {
  try {
    const asset = await Asset.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId }, // ← ADD tenantId
    });
    if (!asset)
      return res
        .status(404)
        .json({ success: false, message: "Asset not found" });

    const oldValues = asset.toJSON();
    const updateData = { ...req.body };

    if (updateData.location && !updateData.locationId)
      updateData.locationId = await resolveLocationId(
        updateData.location,
        req.user.tenantId, // ← ADD tenantId
      );

    // Assignment fields are managed via assign/transfer — block direct update
    delete updateData.assignmentType;
    delete updateData.assignedToId;
    delete updateData.assignedToDeptId;
    delete updateData.assignedToLocId;

    await asset.update(updateData);

    await AuditLog.create({
      entityType: "Asset",
      entityId: asset.id,
      tenantId: req.user.tenantId, // ← ADD
      action: "UPDATE",
      userId: req.user.id,
      oldValues,
      newValues: asset.toJSON(),
      description: `Asset ${asset.assetTag} updated`,
    });

    res.json({ success: true, data: asset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DELETE ASSET ─────────────────────────────────────────────────────────────
exports.deleteAsset = async (req, res) => {
  try {
    const asset = await Asset.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId }, // ← ADD tenantId
    });
    if (!asset)
      return res
        .status(404)
        .json({ success: false, message: "Asset not found" });

    await AuditLog.create({
      entityType: "Asset",
      entityId: asset.id,
      tenantId: req.user.tenantId, // ← ADD
      action: "DELETE",
      userId: req.user.id,
      oldValues: asset.toJSON(),
      description: `Asset ${asset.assetTag} deleted`,
    });

    await asset.destroy();
    res.json({ success: true, message: "Asset deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.regenerateQR = async (req, res) => {
  try {
    const assets = await Asset.findAll({
      where: { tenantId: req.user.tenantId },
    });

    for (const asset of assets) {
      const qrCode = await QRCode.toDataURL(
        `${process.env.FRONTEND_URL}/scan/${asset.assetTag}`,
        { errorCorrectionLevel: "M", margin: 1, width: 300 },
      );
      await asset.update({ qrCode });
    }

    res.json({
      success: true,
      message: `${assets.length} QR codes regenerated`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// ─── EXECUTE ASSIGNMENT (internal helper) ─────────────────────────────────────
async function _executeAssignment({
  asset,
  assignmentType,
  employeeId,
  departmentId,
  locationId,
  assignedById,
  purpose,
  notes,
  conditionAtAssignment,
}) {
  // Deactivate previous assignment
  await Assignment.update(
    { isActive: false, returnedAt: new Date() },
    { where: { assetId: asset.id, tenantId: asset.tenantId, isActive: true } },
  );

  // Create new assignment record
  await Assignment.create({
    assetId: asset.id,
    tenantId: asset.tenantId,
    assignmentType,
    employeeId: assignmentType === "employee" ? employeeId : null,
    departmentId: assignmentType === "department" ? departmentId : null,
    locationId: assignmentType === "location" ? locationId : null,
    assignedById,
    purpose,
    notes,
    conditionAtAssignment: conditionAtAssignment || asset.condition,

    // ✅ NEW — ek line: asset ke current customFields ka snapshot lo
    // Agar customFields null/empty hai toh null store hoga — no problem
    configSnapshot: asset.customFields || null,
  });

  // Update asset current assignment
  await asset.update({
    assignmentType,
    ...clearAssignmentFKs(),
    ...(assignmentType === "employee" ? { assignedToId: employeeId } : {}),
    ...(assignmentType === "department"
      ? { assignedToDeptId: departmentId }
      : {}),
    ...(assignmentType === "location" ? { assignedToLocId: locationId } : {}),
    status: "Active",
  });
}
exports._executeAssignment = _executeAssignment;

// ─── ASSIGN ASSET ─────────────────────────────────────────────────────────────
exports.assignAsset = async (req, res) => {
  try {
    const {
      assignmentType,
      employeeId,
      departmentId,
      locationId,
      purpose,
      notes,
    } = req.body;

    if (!assignmentType)
      return res
        .status(400)
        .json({ success: false, message: "assignmentType required" });

    const asset = await Asset.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!asset)
      return res
        .status(404)
        .json({ success: false, message: "Asset not found" });

    let targetName = "";
    if (assignmentType === "employee") {
      const emp = await Employee.findOne({
        where: { id: employeeId, tenantId: req.user.tenantId },
      });
      if (!emp)
        return res
          .status(404)
          .json({ success: false, message: "Employee not found" });
      targetName = `${emp.firstName} ${emp.lastName}`;
    } else if (assignmentType === "department") {
      const dept = await Department.findOne({
        where: { id: departmentId, tenantId: req.user.tenantId },
      });
      if (!dept)
        return res
          .status(404)
          .json({ success: false, message: "Department not found" });
      targetName = dept.name;
    } else if (assignmentType === "location") {
      const loc = await Location.findOne({
        where: { id: locationId, tenantId: req.user.tenantId },
      });
      if (!loc)
        return res
          .status(404)
          .json({ success: false, message: "Location not found" });
      targetName = loc.name;
    }

    const approvalResult = await approvalEngine.createRequest({
      module: "asset_assignment",
      moduleRecordId: asset.id,
      requestedById: req.user.id,
      tenantId: req.user.tenantId,
      moduleData: {
        assetId: asset.id,
        assetName: asset.name,
        assetTag: asset.assetTag,
        currentValue: asset.currentValue,
        category: asset.category,
        assignmentType,
        employeeId: assignmentType === "employee" ? employeeId : null,
        departmentId: assignmentType === "department" ? departmentId : null,
        locationId: assignmentType === "location" ? locationId : null,
        targetName,
        purpose,
        notes,
        conditionAtAssignment: asset.condition,
      },
      appUrl: process.env.FRONTEND_URL,
    });

    if (approvalResult.autoApproved) {
      await _executeAssignment({
        asset,
        assignmentType,
        employeeId,
        departmentId,
        locationId,
        assignedById: req.user.id,
        purpose,
        notes,
      });

      // ── Audit Log ────────────────────────────────────────────────────────────
      await AuditLog.create({
        entityType: "Asset",
        entityId: asset.id,
        tenantId: req.user.tenantId,
        action: "ASSIGNED",
        userId: req.user.id,
        newValues: { assignmentType, targetName, purpose },
        description: `Asset ${asset.assetTag} assigned to ${targetName}`,
      });

      return res.json({
        success: true,
        approvalRequired: false,
        message: `Asset assigned to ${targetName}`,
      });
    }

    // Approvers ko real-time notify karo
    socketService.emitToTenant(req.user.tenantId, "approval:new", {
      requestNumber: approvalResult.request.requestNumber,
      assetName: asset.name,
      requestedBy: `${req.user.firstName} ${req.user.lastName}`,
    });

    res.json({
      success: true,
      approvalRequired: true,
      requestNumber: approvalResult.request.requestNumber,
      message: `Approval request #${approvalResult.request.requestNumber} created`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── RETURN ASSET ─────────────────────────────────────────────────────────────
exports.returnAsset = async (req, res) => {
  try {
    const { conditionAtReturn, notes } = req.body;
    const asset = await Asset.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!asset)
      return res
        .status(404)
        .json({ success: false, message: "Asset not found" });

    const oldValues = {
      assignmentType: asset.assignmentType,
      assignedToId: asset.assignedToId,
      condition: asset.condition,
    };

    await Assignment.update(
      { isActive: false, returnedAt: new Date(), conditionAtReturn, notes },
      {
        where: {
          assetId: asset.id,
          tenantId: req.user.tenantId,
          isActive: true,
        },
      },
    );

    await asset.update({
      assignmentType: "pool",
      ...clearAssignmentFKs(),
      condition: conditionAtReturn || asset.condition,
    });

    // ── Audit Log ─────────────────────────────────────────────────────────────
    await AuditLog.create({
      entityType: "Asset",
      entityId: asset.id,
      tenantId: req.user.tenantId,
      action: "RETURNED",
      userId: req.user.id,
      oldValues,
      newValues: { assignmentType: "pool", conditionAtReturn, notes },
      description: `Asset ${asset.assetTag} returned to pool`,
    });

    res.json({ success: true, message: "Asset returned to pool" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── TRANSFER ASSET ───────────────────────────────────────────────────────────
exports.transferAsset = async (req, res) => {
  try {
    const {
      assignmentType,
      employeeId,
      departmentId,
      locationId,
      reason,
      notes,
    } = req.body;

    if (!assignmentType)
      return res
        .status(400)
        .json({ success: false, message: "assignmentType required" });

    const asset = await Asset.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId }, // ← ADD tenantId
      include: assetIncludes(),
    });
    if (!asset)
      return res
        .status(404)
        .json({ success: false, message: "Asset not found" });

    let targetName = assignmentType === "pool" ? "Pool" : "";

    if (assignmentType === "employee") {
      const e = await Employee.findOne({
        where: { id: employeeId, tenantId: req.user.tenantId }, // ← ADD tenantId
      });
      if (!e)
        return res
          .status(404)
          .json({ success: false, message: "Employee not found" });
      targetName = `${e.firstName} ${e.lastName}`;
    }
    if (assignmentType === "department") {
      const d = await Department.findOne({
        where: { id: departmentId, tenantId: req.user.tenantId }, // ← ADD tenantId
      });
      if (!d)
        return res
          .status(404)
          .json({ success: false, message: "Department not found" });
      targetName = d.name;
    }
    if (assignmentType === "location") {
      const l = await Location.findOne({
        where: { id: locationId, tenantId: req.user.tenantId }, // ← ADD tenantId
      });
      if (!l)
        return res
          .status(404)
          .json({ success: false, message: "Location not found" });
      targetName = l.name;
    }

    const fromLabel = getAssignedToLabel(asset) || "Pool";

    const approvalResult = await approvalEngine.createRequest({
      module: "asset_transfer",
      moduleRecordId: asset.id,
      requestedById: req.user.id,
      tenantId: req.user.tenantId, // ← ADD
      moduleData: {
        assetId: asset.id,
        assetName: asset.name,
        assetTag: asset.assetTag,
        currentValue: asset.currentValue,
        category: asset.category,
        fromAssignmentType: asset.assignmentType,
        fromLabel,
        toAssignmentType: assignmentType,
        employeeId: assignmentType === "employee" ? employeeId : null,
        departmentId: assignmentType === "department" ? departmentId : null,
        locationId: assignmentType === "location" ? locationId : null,
        targetName,
        toEmployeeName: assignmentType === "employee" ? targetName : null,
        toDepartmentName: assignmentType === "department" ? targetName : null,
        toLocationName: assignmentType === "location" ? targetName : null,
        reason,
        notes,
        requestedBy: `${req.user.firstName} ${req.user.lastName}`,
      },
      appUrl: process.env.FRONTEND_URL,
    });

    if (approvalResult.autoApproved) {
      if (assignmentType === "pool") {
        await Assignment.update(
          { isActive: false, returnedAt: new Date() },
          {
            where: {
              assetId: asset.id,
              tenantId: req.user.tenantId,
              isActive: true,
            },
          }, // ← ADD tenantId
        );
        await asset.update({ assignmentType: "pool", ...clearAssignmentFKs() });
      } else {
        await _executeAssignment({
          asset,
          assignmentType,
          employeeId,
          departmentId,
          locationId,
          assignedById: req.user.id,
          notes: `Transferred from ${fromLabel} — ${reason || notes || ""}`,
        });
      }

      await AuditLog.create({
        entityType: "Asset",
        entityId: asset.id,
        tenantId: req.user.tenantId, // ← ADD
        action: "TRANSFER",
        userId: req.user.id,
        newValues: { from: fromLabel, to: targetName, assignmentType },
        description: `Asset ${asset.assetTag} transferred from ${fromLabel} to ${targetName}`,
      });

      return res.json({
        success: true,
        approvalRequired: false,
        message: `Asset transferred to ${targetName}`,
      });
    }

    res.json({
      success: true,
      approvalRequired: true,
      requestNumber: approvalResult.request.requestNumber,
      message: `Transfer approval request #${approvalResult.request.requestNumber} created`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DISPOSE ASSET ────────────────────────────────────────────────────────────
exports.disposeAsset = async (req, res) => {
  try {
    const { reason, disposalMethod, saleAmount, notes } = req.body;

    if (!reason)
      return res
        .status(400)
        .json({ success: false, message: "Disposal reason required" });

    const asset = await Asset.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId }, // ← ADD tenantId
    });
    if (!asset)
      return res
        .status(404)
        .json({ success: false, message: "Asset not found" });
    if (asset.status === "Disposed")
      return res
        .status(400)
        .json({ success: false, message: "Asset already disposed" });

    const approvalResult = await approvalEngine.createRequest({
      module: "asset_disposal",
      moduleRecordId: asset.id,
      requestedById: req.user.id,
      tenantId: req.user.tenantId, // ← ADD
      moduleData: {
        assetId: asset.id,
        assetName: asset.name,
        assetTag: asset.assetTag,
        currentValue: asset.currentValue,
        category: asset.category,
        reason,
        disposalMethod,
        saleAmount,
        notes,
        requestedBy: `${req.user.firstName} ${req.user.lastName}`,
      },
      appUrl: process.env.FRONTEND_URL,
    });

    if (approvalResult.autoApproved) {
      await Assignment.update(
        { isActive: false, returnedAt: new Date() },
        {
          where: {
            assetId: asset.id,
            tenantId: req.user.tenantId,
            isActive: true,
          },
        }, // ← ADD tenantId
      );
      await asset.update({
        status: "Disposed",
        assignmentType: "pool",
        ...clearAssignmentFKs(),
      });
      await AuditLog.create({
        entityType: "Asset",
        entityId: asset.id,
        tenantId: req.user.tenantId, // ← ADD
        action: "DISPOSE",
        userId: req.user.id,
        oldValues: { status: asset.status },
        newValues: { status: "Disposed", reason, disposalMethod },
        description: `Asset ${asset.assetTag} disposed`,
      });
      return res.json({
        success: true,
        approvalRequired: false,
        message: "Asset disposed",
      });
    }

    res.json({
      success: true,
      approvalRequired: true,
      requestNumber: approvalResult.request.requestNumber,
      message: `Disposal approval request #${approvalResult.request.requestNumber} created`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── SCAN ASSET (QR scan — public but auth protected) ─────────────────────────
exports.scanAsset = async (req, res) => {
  try {
    // scanAsset — assetTag + tenantId se find karo
    const asset = await Asset.findOne({
      where: { assetTag: req.params.assetTag, tenantId: req.user.tenantId }, // ← ADD tenantId
      include: assetIncludes(),
    });
    if (!asset)
      return res
        .status(404)
        .json({ success: false, message: "Asset not found" });

    const [assignments, maintenances] = await Promise.all([
      Assignment.findAll({
        where: { assetId: asset.id, tenantId: req.user.tenantId }, // ← ADD tenantId
        include: [
          {
            model: Employee,
            as: "assignedEmployee",
            attributes: ["id", "firstName", "lastName", "designation"],
          },
          { model: Department, as: "assignedDept", attributes: ["id", "name"] },
          { model: Location, as: "assignedLoc", attributes: ["id", "name"] },
        ],
        order: [["assignedAt", "DESC"]],
        limit: 10,
      }),
      Maintenance.findAll({
        where: { assetId: asset.id, tenantId: req.user.tenantId }, // ← ADD tenantId
        include: [
          {
            model: Employee,
            as: "technician",
            attributes: ["id", "firstName", "lastName"],
          },
        ],
        order: [["createdAt", "DESC"]],
        limit: 10,
      }),
    ]);

    res.json({
      success: true,
      data: {
        ...asset.toJSON(),
        assignmentHistory: assignments,
        maintenanceHistory: maintenances,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── ASSET HISTORY ────────────────────────────────────────────────────────────
exports.getAssetHistory = async (req, res) => {
  try {
    const [logs, assignments, approvalRequests] = await Promise.all([
      AuditLog.findAll({
        where: {
          entityType: "Asset",
          entityId: req.params.id,
          tenantId: req.user.tenantId,
        }, // ← ADD tenantId
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "firstName", "lastName", "email"],
          },
        ],
        order: [["createdAt", "DESC"]],
      }),
      Assignment.findAll({
        where: { assetId: req.params.id, tenantId: req.user.tenantId }, // ← ADD tenantId
        include: [
          {
            model: Employee,
            as: "assignedEmployee",
            attributes: ["id", "firstName", "lastName", "email"],
          },
          { model: Department, as: "assignedDept", attributes: ["id", "name"] },
          { model: Location, as: "assignedLoc", attributes: ["id", "name"] },
        ],
        order: [["assignedAt", "DESC"]],
      }),
      ApprovalRequest.findAll({
        where: { moduleRecordId: req.params.id, tenantId: req.user.tenantId }, // ← ADD tenantId
        order: [["createdAt", "DESC"]],
        limit: 10,
      }),
    ]);

    res.json({ success: true, data: { logs, assignments, approvalRequests } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── ASSET TIMELINE ───────────────────────────────────────────────────────────
exports.getAssetTimeline = async (req, res) => {
  try {
    const asset = await Asset.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId }, // ← ADD tenantId
      include: assetIncludes(),
    });
    if (!asset)
      return res
        .status(404)
        .json({ success: false, message: "Asset not found" });

    const [auditLogs, assignments, maintenances, approvalRequests] =
      await Promise.all([
        AuditLog.findAll({
          where: {
            entityType: "Asset",
            entityId: req.params.id,
            tenantId: req.user.tenantId,
          }, // ← ADD
          // include: [
          //   {
          //     model: User,
          //     attributes: ["id", "firstName", "lastName", "email"],
          //   },
          // ],
          order: [["createdAt", "ASC"]],
        }),
        Assignment.findAll({
          where: { assetId: req.params.id, tenantId: req.user.tenantId }, // ← ADD
          include: [
            {
              model: Employee,
              as: "assignedEmployee",
              attributes: [
                "id",
                "firstName",
                "lastName",
                "email",
                "designation",
              ],
            },
            {
              model: Department,
              as: "assignedDept",
              attributes: ["id", "name"],
            },
            { model: Location, as: "assignedLoc", attributes: ["id", "name"] },
            {
              model: User,
              as: "assignedBy",
              attributes: ["id", "firstName", "lastName"],
            },
          ],
          order: [["assignedAt", "ASC"]],
        }),
        Maintenance.findAll({
          where: { assetId: req.params.id, tenantId: req.user.tenantId }, // ← ADD
          include: [
            {
              model: Employee,
              as: "technician",
              attributes: ["id", "firstName", "lastName"],
            },
          ],
          order: [["scheduledDate", "ASC"]],
        }),
        require("../models/Approval").ApprovalRequest.findAll({
          where: { moduleRecordId: req.params.id, tenantId: req.user.tenantId }, // ← ADD
          include: [
            {
              model: User,
              as: "requestedBy",
              attributes: ["id", "firstName", "lastName"],
            },
          ],
          order: [["createdAt", "ASC"]],
        }),
      ]);

    // ── Build timeline events (no changes needed here — same logic) ───────────
    const events = [];

    if (asset.purchaseDate)
      events.push({
        type: "PURCHASED",
        icon: "purchase",
        color: "#7c3aed",
        date: asset.purchaseDate,
        title: "Asset Purchased",
        details: {
          purchasePrice: asset.purchasePrice,
          vendor: asset.vendor,
          warrantyExpiry: asset.warrantyExpiry,
        },
      });

    auditLogs.forEach((log) => {
      if (log.action === "CREATE") {
        events.push({
          type: "CREATED",
          icon: "create",
          color: "#00d4ff",
          date: log.createdAt,
          title: "Added to System",
          details: {
            addedBy: log.User
              ? `${log.User.firstName} ${log.User.lastName}`
              : "System",
          },
        });
      } else if (log.action === "UPDATE") {
        const changes = ["status", "condition", "location", "currentValue"]
          .filter(
            (f) =>
              log.oldValues?.[f] !== undefined &&
              log.oldValues[f] !== log.newValues?.[f],
          )
          .map((f) => ({
            field: f,
            from: log.oldValues[f],
            to: log.newValues[f],
          }));
        if (changes.length > 0)
          events.push({
            type: "UPDATED",
            icon: "update",
            color: "#ffb703",
            date: log.createdAt,
            title: "Asset Updated",
            details: {
              updatedBy: log.User
                ? `${log.User.firstName} ${log.User.lastName}`
                : "System",
              changes,
            },
          });
      }
    });

    assignments.forEach((assign, index) => {
      let assignedToLabel = "Unknown",
        assignedToDetail = null;
      if (assign.assignmentType === "employee" && assign.assignedEmployee) {
        assignedToLabel = `${assign.assignedEmployee.firstName} ${assign.assignedEmployee.lastName}`;
        assignedToDetail = assign.assignedEmployee.designation;
      } else if (
        assign.assignmentType === "department" &&
        assign.assignedDept
      ) {
        assignedToLabel = assign.assignedDept.name;
        assignedToDetail = "Department";
      } else if (assign.assignmentType === "location" && assign.assignedLoc) {
        assignedToLabel = assign.assignedLoc.name;
        assignedToDetail = "Location / Branch";
      } else if (assign.assignmentType === "pool") {
        assignedToLabel = "Pool (Available)";
      }

      events.push({
        type: index > 0 ? "REASSIGNED" : "ASSIGNED",
        icon: "assign",
        color: "#00d68f",
        date: assign.assignedAt || assign.createdAt,
        title: index > 0 ? "Re-Assigned" : "Assigned",
        details: {
          assignmentType: assign.assignmentType,
          assignedTo: assignedToLabel,
          assignedToDetail,
          assignedBy: assign.assignedBy
            ? `${assign.assignedBy.firstName} ${assign.assignedBy.lastName}`
            : "System",
          purpose: assign.purpose,
          conditionAtAssignment: assign.conditionAtAssignment,
        },
      });

      if (assign.returnedAt)
        events.push({
          type: "RETURNED",
          icon: "return",
          color: "#ff8c42",
          date: assign.returnedAt,
          title: "Asset Returned to Pool",
          details: {
            returnedFrom: assignedToLabel,
            conditionAtReturn: assign.conditionAtReturn || "Not recorded",
            durationDays: assign.assignedAt
              ? Math.floor(
                  (new Date(assign.returnedAt) - new Date(assign.assignedAt)) /
                    (1000 * 60 * 60 * 24),
                )
              : null,
          },
        });
    });

    maintenances.forEach((m) =>
      events.push({
        type: "MAINTENANCE",
        icon: "maintenance",
        color: "#339af0",
        date: m.scheduledDate || m.createdAt,
        title: `Maintenance — ${m.type}`,
        details: {
          maintenanceType: m.type,
          maintenanceTitle: m.title,
          status: m.status,
          priority: m.priority,
          technician: m.technician
            ? `${m.technician.firstName} ${m.technician.lastName}`
            : "Unassigned",
          cost: m.cost,
          completedDate: m.completedDate,
          vendor: m.vendor,
        },
      }),
    );

    approvalRequests.forEach((r) => {
      if (r.status === "approved" || r.status === "rejected")
        events.push({
          type:
            r.status === "approved" ? "APPROVAL_GRANTED" : "APPROVAL_REJECTED",
          icon: r.status === "approved" ? "approved" : "rejected",
          color: r.status === "approved" ? "#00d68f" : "#ff4757",
          date: r.finalizedAt || r.createdAt,
          title:
            r.status === "approved" ? "Approval Granted" : "Approval Rejected",
          details: {
            requestNumber: r.requestNumber,
            module: r.module?.replace(/_/g, " "),
            requestedBy: r.requestedBy
              ? `${r.requestedBy.firstName} ${r.requestedBy.lastName}`
              : "Unknown",
            remarks: r.finalRemarks,
          },
        });
    });

    const disposalLog = auditLogs.find(
      (l) => l.newValues?.status === "Disposed",
    );
    if (disposalLog)
      events.push({
        type: "DISPOSED",
        icon: "dispose",
        color: "#ff4757",
        date: disposalLog.createdAt,
        title: "Asset Disposed",
        details: {
          disposedBy: disposalLog.User
            ? `${disposalLog.User.firstName} ${disposalLog.User.lastName}`
            : "System",
        },
      });

    events.sort((a, b) => new Date(a.date) - new Date(b.date));
    const currentHolder = getAssignedToLabel(asset) || "Unassigned (Pool)";

    res.json({
      success: true,
      data: {
        asset: {
          id: asset.id,
          name: asset.name,
          assetTag: asset.assetTag,
          category: asset.category,
          status: asset.status,
          condition: asset.condition,
          currentValue: asset.currentValue,
          purchasePrice: asset.purchasePrice,
          purchaseDate: asset.purchaseDate,
          assignmentType: asset.assignmentType,
          assignedToEmployee: asset.assignedToEmployee,
          assignedToDept: asset.assignedToDept,
          assignedToLoc: asset.assignedToLoc,
        },
        timeline: events,
        summary: {
          totalEvents: events.length,
          totalAssignments: assignments.length,
          totalMaintenances: maintenances.length,
          totalMaintenanceCost: maintenances.reduce(
            (s, m) => s + (parseFloat(m.cost) || 0),
            0,
          ),
          totalDaysAssigned: assignments.reduce((s, a) => {
            if (!a.assignedAt) return s;
            const end = a.returnedAt ? new Date(a.returnedAt) : new Date();
            return (
              s +
              Math.floor((end - new Date(a.assignedAt)) / (1000 * 60 * 60 * 24))
            );
          }, 0),
          ageDays: asset.purchaseDate
            ? Math.floor(
                (new Date() - new Date(asset.purchaseDate)) /
                  (1000 * 60 * 60 * 24),
              )
            : null,
          currentStatus: asset.status,
          currentHolder,
          assignmentType: asset.assignmentType,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const { fn, col, literal } = require("sequelize");
    const tId = req.user.tenantId;

    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    // Last 6 months range
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [
      total,
      active,
      maintenance,
      disposed,
      totalValue,
      categoryStats,
      statusStats,
      assignmentTypeStats,
      recentAssets,
      // ── Naye 3 ──
      warrantyExpiringAssets,
      maintenanceDueSoon,
      monthlyTrend,
    ] = await Promise.all([
      Asset.count({ where: { tenantId: tId } }),
      Asset.count({ where: { tenantId: tId, status: "Active" } }),
      Asset.count({ where: { tenantId: tId, status: "In Maintenance" } }),
      Asset.count({ where: { tenantId: tId, status: "Disposed" } }),
      Asset.sum("currentValue", { where: { tenantId: tId } }),

      Asset.findAll({
        where: { tenantId: tId },
        attributes: ["categoryId", [fn("COUNT", col("Asset.id")), "count"]],
        group: ["categoryId"],
        raw: true,
        include: [{ model: Category, as: "category", attributes: ["name"] }],
      }),

      Asset.findAll({
        where: { tenantId: tId },
        attributes: ["status", [fn("COUNT", col("id")), "count"]],
        group: ["status"],
        raw: true,
      }),

      Asset.findAll({
        where: { tenantId: tId },
        attributes: ["assignmentType", [fn("COUNT", col("id")), "count"]],
        group: ["assignmentType"],
        raw: true,
      }),

      Asset.findAll({
        where: { tenantId: tId },
        limit: 5,
        order: [["createdAt", "DESC"]],
        attributes: [
          "id",
          "assetTag",
          "name",
          "status",
          "currentValue",
          "assignmentType",
          // qrCode intentionally exclude kiya
        ],
        include: [
          {
            model: Employee,
            as: "assignedToEmployee",
            attributes: ["firstName", "lastName"],
          },
          { model: Department, as: "assignedToDept", attributes: ["name"] },
          { model: Location, as: "assignedToLoc", attributes: ["name"] },
        ],
      }),

      // ── NEW 1 — Warranty expiring assets list
      Asset.findAll({
        where: {
          tenantId: tId,
          warrantyExpiry: { [Op.between]: [new Date(), thirtyDaysLater] },
          status: { [Op.ne]: "Disposed" },
        },
        attributes: ["id", "name", "assetTag", "warrantyExpiry", "status"],
        order: [["warrantyExpiry", "ASC"]],
        limit: 5,
        raw: true,
      }),

      // ── NEW 2 — Maintenance due in next 7 days
      Maintenance.findAll({
        where: {
          tenantId: tId,
          status: { [Op.in]: ["Scheduled", "In Progress", "Overdue"] },
          [Op.or]: [
            // Overdue — past mein scheduled
            { scheduledDate: { [Op.lt]: new Date() } },
            // Due soon — next 7 days
            { scheduledDate: { [Op.between]: [new Date(), sevenDaysLater] } },
          ],
        },
        attributes: ["id", "title", "scheduledDate", "priority", "status"],
        order: [["scheduledDate", "ASC"]],
        limit: 8, // thoda zyada limit — overdue + upcoming dono fit hon
        raw: true,
      }),

      // ── NEW 3 — Monthly acquisition trend (last 6 months)
      Asset.findAll({
        where: {
          tenantId: tId,
          createdAt: { [Op.gte]: sixMonthsAgo },
        },
        attributes: [
          [fn("DATE_FORMAT", col("createdAt"), "%Y-%m"), "monthKey"],
          [fn("DATE_FORMAT", col("createdAt"), "%b %Y"), "month"],
          [fn("COUNT", col("id")), "count"],
        ],
        group: [
          fn("DATE_FORMAT", col("createdAt"), "%Y-%m"),
          fn("DATE_FORMAT", col("createdAt"), "%b %Y"),
        ],
        order: [[fn("DATE_FORMAT", col("createdAt"), "%Y-%m"), "ASC"]], // ← grouped column
        raw: true,
      }),
    ]);

    const [warrantyExpiring, pendingApprovals] = await Promise.all([
      Asset.count({
        where: {
          tenantId: tId,
          warrantyExpiry: { [Op.between]: [new Date(), thirtyDaysLater] },
        },
      }),
      ApprovalRequestStep.count({
        where: { assignedToUserId: req.user.id, status: "pending" },
      }),
    ]);

    res.json({
      success: true,
      data: {
        total,
        active,
        maintenance,
        disposed,
        inactive: total - active - maintenance - disposed,
        totalValue: totalValue || 0,
        warrantyExpiring,
        categoryStats,
        statusStats,
        assignmentTypeStats,
        recentAssets,
        pendingApprovals,
        // ── Naye 3
        warrantyExpiringAssets,
        maintenanceDueSoon,
        monthlyTrend,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
