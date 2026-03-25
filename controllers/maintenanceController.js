const { Op } = require("sequelize");
const { AuditLog, Maintenance } = require("../models/index");
const Asset = require("../models/Asset");
const Employee = require("../models/Employee");

// ─── GET MAINTENANCES ─────────────────────────────────────────────────────────
exports.getMaintenances = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, priority, type, assetId } = req.query;

    const where = { tenantId: req.user.tenantId }; // ← ADD
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (type) where.type = type;
    if (assetId) where.assetId = assetId;

    // Auto-update overdue — sirf usi tenant ke records update karo
    await Maintenance.update(
      { status: "Overdue" },
      {
        where: {
          tenantId: req.user.tenantId, // ← ADD
          status: "Scheduled",
          scheduledDate: { [Op.lt]: new Date() },
        },
      },
    );

    const { count, rows } = await Maintenance.findAndCountAll({
      where,
      include: [
        {
          model: Asset,
          attributes: ["id", "name", "assetTag", "categoryId", "location"],
        },
        {
          model: Employee,
          as: "technician",
          attributes: ["id", "firstName", "lastName", "email", "designation"],
        },
      ],
      order: [["scheduledDate", "ASC"]],
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

// ─── CREATE MAINTENANCE ───────────────────────────────────────────────────────
exports.createMaintenance = async (req, res) => {
  try {
    // Asset validate karo — sirf usi tenant ka asset
    const asset = await Asset.findOne({
      where: { id: req.body.assetId, tenantId: req.user.tenantId }, // ← ADD
    });
    if (!asset)
      return res
        .status(404)
        .json({ success: false, message: "Asset not found" });

    const maintenance = await Maintenance.create({
      ...req.body,
      tenantId: req.user.tenantId, // ← ADD
    });
    // createMaintenance — asset update ke baad add karo:
    await AuditLog.create({
      entityType: "Maintenance",
      entityId: maintenance.id,
      tenantId: req.user.tenantId,
      action: "CREATE",
      userId: req.user.id,
      newValues: maintenance.toJSON(),
      description: `Maintenance record created for asset ${asset.assetTag}`,
    });

    if (req.body.status === "In Progress" || req.body.status === "Scheduled") {
      await Asset.update(
        { status: "In Maintenance" },
        { where: { id: req.body.assetId, tenantId: req.user.tenantId } }, // ← ADD tenantId
      );
    }

    res.status(201).json({ success: true, data: maintenance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── UPDATE MAINTENANCE ───────────────────────────────────────────────────────
exports.updateMaintenance = async (req, res) => {
  try {
    const maintenance = await Maintenance.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId }, // ← ADD tenantId
    });
    if (!maintenance)
      return res
        .status(404)
        .json({ success: false, message: "Maintenance not found" });

    const oldValues = maintenance.toJSON(); // update se PEHLE
    await maintenance.update(req.body);
    await AuditLog.create({
      entityType: "Maintenance",
      entityId: maintenance.id,
      tenantId: req.user.tenantId,
      action: "UPDATE",
      userId: req.user.id,
      oldValues,
      newValues: maintenance.toJSON(),
      description: `Maintenance record updated — status: ${req.body.status || maintenance.status}`,
    });

    if (req.body.status === "Completed") {
      await Asset.update(
        { status: "Active", lastAuditDate: new Date() },
        { where: { id: maintenance.assetId, tenantId: req.user.tenantId } }, // ← ADD tenantId
      );
    }

    res.json({ success: true, data: maintenance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DELETE MAINTENANCE ───────────────────────────────────────────────────────
exports.deleteMaintenance = async (req, res) => {
  try {
    const maintenance = await Maintenance.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId }, // ← ADD tenantId
    });
    if (!maintenance)
      return res
        .status(404)
        .json({ success: false, message: "Maintenance not found" });

    // deleteMaintenance — destroy se PEHLE add karo:
    const oldValues = maintenance.toJSON();
    await AuditLog.create({
      entityType: "Maintenance",
      entityId: maintenance.id,
      tenantId: req.user.tenantId,
      action: "DELETE",
      userId: req.user.id,
      oldValues,
      description: `Maintenance record deleted for asset ID ${maintenance.assetId}`,
    });
    await maintenance.destroy();
    res.json({ success: true, message: "Maintenance record deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET MAINTENANCE STATS ────────────────────────────────────────────────────
exports.getMaintenanceStats = async (req, res) => {
  try {
    const { fn, col } = require("sequelize");

    const stats = await Maintenance.findAll({
      where: { tenantId: req.user.tenantId }, // ← ADD
      attributes: [
        "status",
        [fn("COUNT", col("id")), "count"],
        [fn("SUM", col("cost")), "totalCost"],
      ],
      group: ["status"],
      raw: true,
    });

    const upcoming = await Maintenance.findAll({
      where: {
        tenantId: req.user.tenantId, // ← ADD
        status: "Scheduled",
        scheduledDate: {
          [Op.gte]: new Date(),
          [Op.lte]: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      include: [{ model: Asset, attributes: ["name", "assetTag"] }],
      limit: 5,
      order: [["scheduledDate", "ASC"]],
    });

    res.json({ success: true, data: { stats, upcoming } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
