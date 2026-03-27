// controllers/amcController.js
const { Op } = require("sequelize");
const AmcContract = require("../models/AmcContract");
const AmcServiceVisit = require("../models/AmcServiceVisit");
const Asset = require("../models/Asset");
const { AuditLog } = require("../models/index");

// ── Helper: Auto update status based on dates ─────────────────────────────────
const resolveStatus = (startDate, endDate) => {
  const today = new Date();
  const end = new Date(endDate);
  const start = new Date(startDate);
  const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));

  if (today < start) return "Active";
  if (diffDays < 0) return "Expired";
  if (diffDays <= 30) return "Pending Renewal";
  return "Active";
};

// ── GET /amc — List all contracts with filters ────────────────────────────────
exports.getAllAMC = async (req, res) => {
  try {
    const {
      search = "",
      status = "",
      contractType = "",
      page = 1,
      limit = 20,
    } = req.query;

    const tenantId = req.user.tenantId; // ✅

    const where = { tenantId }; // ✅
    if (search) {
      where[Op.or] = [
        { contractNumber: { [Op.like]: `%${search}%` } },
        { vendorName: { [Op.like]: `%${search}%` } },
      ];
    }
    if (status) where.status = status;
    if (contractType) where.contractType = contractType;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await AmcContract.findAndCountAll({
      where,
      include: [
        {
          model: Asset,
          as: "assets",
          attributes: ["id", "name", "assetTag"],
          through: { attributes: [] },
        },
      ],
      order: [["endDate", "ASC"]],
      limit: parseInt(limit),
      offset,
      distinct: true,
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /amc/:id — Single contract detail ─────────────────────────────────────
exports.getByIdAMC = async (req, res) => {
  try {
    const tenantId = req.user.tenantId; // ✅

    const contract = await AmcContract.findOne({
      where: { id: req.params.id, tenantId }, // ✅ findByPk → findOne with tenantId check
      include: [
        {
          model: Asset,
          as: "assets",
          attributes: ["id", "name", "assetTag", "status"],
          through: { attributes: [] },
        },
        {
          model: AmcServiceVisit,
          as: "serviceVisits",
          order: [["visitDate", "DESC"]],
          include: [
            {
              model: Asset,
              as: "asset",
              attributes: ["id", "name", "assetTag"],
            },
          ],
        },
      ],
    });

    if (!contract)
      return res.status(404).json({ success: false, message: "Not found" });

    res.json({ success: true, data: contract });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /amc — Create contract ───────────────────────────────────────────────
exports.createAMC = async (req, res) => {
  try {
    const tenantId = req.user.tenantId; // ✅

    const {
      contractNumber,
      vendorName,
      vendorContact,
      vendorEmail,
      contractType,
      coverageType,
      serviceFrequency,
      startDate,
      endDate,
      contractCost,
      remarks,
      documentUrl,
      assetIds = [],
    } = req.body;

    if (!contractNumber || !vendorName || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "contractNumber, vendorName, startDate, endDate required",
      });
    }

    const status = resolveStatus(startDate, endDate);

    const contract = await AmcContract.create({
      contractNumber,
      vendorName,
      vendorContact,
      vendorEmail,
      contractType,
      coverageType,
      serviceFrequency,
      startDate,
      endDate,
      contractCost,
      remarks,
      documentUrl,
      status,
      tenantId, // ✅
      createdBy: req.user?.id,
    });

    if (assetIds.length > 0) {
      await contract.setAssets(assetIds);
    }

    const full = await AmcContract.findOne({
      where: { id: contract.id, tenantId }, // ✅
      include: [{ model: Asset, as: "assets", through: { attributes: [] } }],
    });
    await AuditLog.create({
      entityType: "AmcContract",
      entityId: contract.id,
      tenantId,
      action: "CREATE",
      userId: req.user.id,
      newValues: full.toJSON(),
      description: `AMC Contract "${contractNumber}" created for vendor "${vendorName}"`,
    });
    res.status(201).json({ success: true, data: full });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        success: false,
        message: "Contract number already exists for this tenant",
      }); // ✅ message updated
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /amc/:id — Update contract ───────────────────────────────────────────
exports.updateAMC = async (req, res) => {
  try {
    const tenantId = req.user.tenantId; // ✅

    const contract = await AmcContract.findOne({
      where: { id: req.params.id, tenantId }, // ✅
    });
    if (!contract)
      return res.status(404).json({ success: false, message: "Not found" });

    const { assetIds, ...rest } = req.body;

    const startDate = rest.startDate || contract.startDate;
    const endDate = rest.endDate || contract.endDate;
    rest.status = resolveStatus(startDate, endDate);
    if (req.body.status === "Cancelled") rest.status = "Cancelled";

    // tenantId override hone se bachao ✅
    delete rest.tenantId;

    await contract.update(rest);

    if (assetIds !== undefined) {
      await contract.setAssets(assetIds);
    }

    const full = await AmcContract.findOne({
      where: { id: contract.id, tenantId }, // ✅
      include: [
        { model: Asset, as: "assets", through: { attributes: [] } },
        { model: AmcServiceVisit, as: "serviceVisits" },
      ],
    });
    await AuditLog.create({
      entityType: "AmcContract",
      entityId: contract.id,
      tenantId,
      action: "UPDATE",
      userId: req.user.id,
      newValues: full.toJSON(),
      description: `AMC Contract "${contract.contractNumber}" updated`,
    });
    res.json({ success: true, data: full });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DELETE /amc/:id ───────────────────────────────────────────────────────────
exports.removeAMC = async (req, res) => {
  try {
    const tenantId = req.user.tenantId; // ✅

    const contract = await AmcContract.findOne({
      where: { id: req.params.id, tenantId }, // ✅
    });
    if (!contract)
      return res.status(404).json({ success: false, message: "Not found" });
    await AuditLog.create({
      entityType: "AmcContract",
      entityId: contract.id,
      tenantId,
      action: "DELETE",
      userId: req.user.id,
      oldValues: contract.toJSON(),
      description: `AMC Contract "${contract.contractNumber}" deleted`,
    });
    await contract.destroy();
    res.json({ success: true, message: "Contract deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /amc/expiring — Contracts expiring in next N days ────────────────────
exports.getExpiringAMC = async (req, res) => {
  try {
    const tenantId = req.user.tenantId; // ✅
    const days = parseInt(req.query.days) || 30;
    const today = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);

    const contracts = await AmcContract.findAll({
      where: {
        tenantId, // ✅
        endDate: { [Op.between]: [today, future] },
        status: { [Op.ne]: "Cancelled" },
      },
      include: [
        {
          model: Asset,
          as: "assets",
          attributes: ["id", "name", "assetTag"],
          through: { attributes: [] },
        },
      ],
      order: [["endDate", "ASC"]],
    });

    res.json({ success: true, data: contracts, count: contracts.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /amc/asset/:assetId/coverage — Asset AMC coverage check ──────────────
exports.checkAssetCoverage = async (req, res) => {
  try {
    const tenantId = req.user.tenantId; // ✅
    const { assetId } = req.params;
    const today = new Date();

    const asset = await Asset.findOne({
      where: { id: assetId, tenantId }, // ✅ findByPk → findOne
      attributes: ["id", "name", "assetTag", "warrantyExpiry"],
    });

    if (!asset)
      return res
        .status(404)
        .json({ success: false, message: "Asset not found" });

    // 1. Warranty check
    if (asset.warrantyExpiry && new Date(asset.warrantyExpiry) >= today) {
      return res.json({
        success: true,
        coverage: "warranty",
        label: "✅ Covered by Warranty",
        detail: `Warranty valid till ${asset.warrantyExpiry}`,
      });
    }

    // 2. AMC check
    const amcContract = await AmcContract.findOne({
      where: {
        status: "Active",
        tenantId, // ✅
      },
      include: [
        {
          model: Asset,
          as: "assets",
          where: { id: assetId },
          through: { attributes: [] },
        },
      ],
    });

    if (amcContract) {
      return res.json({
        success: true,
        coverage: "amc",
        label: "🔵 Covered by AMC",
        detail: `Contract: ${amcContract.contractNumber} | Valid till ${amcContract.endDate}`,
        contract: {
          id: amcContract.id,
          contractNumber: amcContract.contractNumber,
          vendorName: amcContract.vendorName,
          endDate: amcContract.endDate,
        },
      });
    }

    // 3. Chargeable
    return res.json({
      success: true,
      coverage: "chargeable",
      label: "🔴 Chargeable Repair",
      detail: "No active warranty or AMC contract found",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /amc/:id/visits — Add service visit log ──────────────────────────────
exports.addAMCVisit = async (req, res) => {
  try {
    const tenantId = req.user.tenantId; // ✅

    // Pehle verify karo contract usi tenant ka hai
    const contract = await AmcContract.findOne({
      where: { id: req.params.id, tenantId }, // ✅
    });
    if (!contract)
      return res
        .status(404)
        .json({ success: false, message: "Contract not found" });

    const visit = await AmcServiceVisit.create({
      ...req.body,
      contractId: req.params.id,
      tenantId, // ✅ (agar AmcServiceVisit model mein tenantId hai)
      createdBy: req.user?.id,
    });
    await AuditLog.create({
      entityType: "AmcServiceVisit",
      entityId: visit.id,
      tenantId,
      action: "CREATE",
      userId: req.user.id,
      newValues: visit.toJSON(),
      description: `Service visit logged for contract "${contract.contractNumber}"`,
    });
    res.status(201).json({ success: true, data: visit });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /amc/:id/visits — Get all visits for a contract ──────────────────────
exports.getAMCVisits = async (req, res) => {
  try {
    const tenantId = req.user.tenantId; // ✅

    // Contract ownership verify karo ✅
    const contract = await AmcContract.findOne({
      where: { id: req.params.id, tenantId },
    });
    if (!contract)
      return res
        .status(404)
        .json({ success: false, message: "Contract not found" });

    const visits = await AmcServiceVisit.findAll({
      where: { contractId: req.params.id },
      include: [
        { model: Asset, as: "asset", attributes: ["id", "name", "assetTag"] },
      ],
      order: [["visitDate", "DESC"]],
    });

    res.json({ success: true, data: visits });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
