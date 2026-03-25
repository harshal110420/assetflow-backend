const Division = require("../models/Division");
const Department = require("../models/Department");
const { AuditLog } = require("../models/index");

// ── DIVISIONS ─────────────────────────────────────────────────────────────────

exports.getDivisions = async (req, res) => {
  try {
    const divisions = await Division.findAll({
      where: { isActive: true, tenantId: req.user.tenantId },
      include: [
        {
          model: Department,
          as: "departments",
          attributes: ["id", "name", "code"],
        },
      ],
      order: [["name", "ASC"]],
    });
    res.json({ success: true, data: divisions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createDivision = async (req, res) => {
  try {
    const { name, code, description } = req.body;
    if (!name)
      return res
        .status(400)
        .json({ success: false, message: "Division name required" });

    const division = await Division.create({
      name,
      code,
      description,
      tenantId: req.user.tenantId,
      isActive: true,
    });

    // ── Audit Log ─────────────────────────────────────────────────────────────
    await AuditLog.create({
      entityType: "Division",
      entityId: division.id,
      tenantId: req.user.tenantId,
      action: "CREATE",
      userId: req.user.id,
      newValues: division.toJSON(),
      description: `Division "${name}" created`,
    });

    res.status(201).json({ success: true, data: division });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateDivision = async (req, res) => {
  try {
    const division = await Division.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!division)
      return res
        .status(404)
        .json({ success: false, message: "Division not found" });

    const oldValues = division.toJSON();
    await division.update(req.body);

    // ── Audit Log ─────────────────────────────────────────────────────────────
    await AuditLog.create({
      entityType: "Division",
      entityId: division.id,
      tenantId: req.user.tenantId,
      action: "UPDATE",
      userId: req.user.id,
      oldValues,
      newValues: division.toJSON(),
      description: `Division "${division.name}" updated`,
    });

    res.json({ success: true, data: division });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteDivision = async (req, res) => {
  try {
    const division = await Division.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!division)
      return res
        .status(404)
        .json({ success: false, message: "Division not found" });

    const oldValues = division.toJSON();
    await division.update({ isActive: false });

    // ── Audit Log ─────────────────────────────────────────────────────────────
    await AuditLog.create({
      entityType: "Division",
      entityId: division.id,
      tenantId: req.user.tenantId,
      action: "DEACTIVATE",
      userId: req.user.id,
      oldValues,
      newValues: { isActive: false },
      description: `Division "${oldValues.name}" deactivated`,
    });

    res.json({ success: true, message: "Division deactivated" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DEPARTMENTS ───────────────────────────────────────────────────────────────

exports.getDepartments = async (req, res) => {
  try {
    const { divisionId } = req.query;
    const where = { isActive: true, tenantId: req.user.tenantId };
    if (divisionId) where.divisionId = divisionId;

    const departments = await Department.findAll({
      where,
      include: [
        { model: Division, as: "division", attributes: ["id", "name", "code"] },
      ],
      order: [["name", "ASC"]],
    });
    res.json({ success: true, data: departments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createDepartment = async (req, res) => {
  try {
    const { name, code, divisionId, description } = req.body;
    if (!name || !divisionId)
      return res
        .status(400)
        .json({ success: false, message: "Name and divisionId required" });

    const division = await Division.findOne({
      where: { id: divisionId, tenantId: req.user.tenantId },
    });
    if (!division)
      return res
        .status(404)
        .json({ success: false, message: "Division not found" });

    const dept = await Department.create({
      name,
      code,
      divisionId,
      description,
      tenantId: req.user.tenantId,
      isActive: true,
    });

    // ── Audit Log ─────────────────────────────────────────────────────────────
    await AuditLog.create({
      entityType: "Department",
      entityId: dept.id,
      tenantId: req.user.tenantId,
      action: "CREATE",
      userId: req.user.id,
      newValues: dept.toJSON(),
      description: `Department "${name}" created under division "${division.name}"`,
    });

    res.status(201).json({ success: true, data: dept });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const dept = await Department.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!dept)
      return res
        .status(404)
        .json({ success: false, message: "Department not found" });

    const oldValues = dept.toJSON();
    await dept.update(req.body);

    // ── Audit Log ─────────────────────────────────────────────────────────────
    await AuditLog.create({
      entityType: "Department",
      entityId: dept.id,
      tenantId: req.user.tenantId,
      action: "UPDATE",
      userId: req.user.id,
      oldValues,
      newValues: dept.toJSON(),
      description: `Department "${dept.name}" updated`,
    });

    res.json({ success: true, data: dept });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const dept = await Department.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!dept)
      return res
        .status(404)
        .json({ success: false, message: "Department not found" });

    const oldValues = dept.toJSON();
    await dept.update({ isActive: false });

    // ── Audit Log ─────────────────────────────────────────────────────────────
    await AuditLog.create({
      entityType: "Department",
      entityId: dept.id,
      tenantId: req.user.tenantId,
      action: "DEACTIVATE",
      userId: req.user.id,
      oldValues,
      newValues: { isActive: false },
      description: `Department "${oldValues.name}" deactivated`,
    });

    res.json({ success: true, message: "Department deactivated" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
