const Brand = require("../models/Brand");
const { AuditLog } = require("../models/index");

exports.getAllBrands = async (req, res) => {
  try {
    const brands = await Brand.findAll({
      where: { tenantId: req.user.tenantId },
      order: [["name", "ASC"]],
    });
    res.json({ success: true, data: brands });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getBrandById = async (req, res) => {
  try {
    const brand = await Brand.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!brand)
      return res
        .status(404)
        .json({ success: false, message: "Brand not found" });
    res.json({ success: true, data: brand });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createBrand = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name)
      return res
        .status(400)
        .json({ success: false, message: "Name is required" });

    const brand = await Brand.create({
      name,
      description,
      tenantId: req.user.tenantId,
      createdBy: req.user.id,
    });

    await AuditLog.create({
      entityType: "Brand",
      entityId: brand.id,
      tenantId: req.user.tenantId,
      action: "CREATE",
      userId: req.user.id,
      newValues: brand.toJSON(),
      description: `Brand "${brand.name}" created`,
    });

    res.status(201).json({ success: true, data: brand });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateBrand = async (req, res) => {
  try {
    const brand = await Brand.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!brand)
      return res
        .status(404)
        .json({ success: false, message: "Brand not found" });

    const oldValues = brand.toJSON();
    await brand.update(req.body);

    await AuditLog.create({
      entityType: "Brand",
      entityId: brand.id,
      tenantId: req.user.tenantId,
      action: "UPDATE",
      userId: req.user.id,
      oldValues,
      newValues: brand.toJSON(),
      description: `Brand "${brand.name}" updated`,
    });

    res.json({ success: true, data: brand });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteBrand = async (req, res) => {
  try {
    const brand = await Brand.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!brand)
      return res
        .status(404)
        .json({ success: false, message: "Brand not found" });

    await AuditLog.create({
      entityType: "Brand",
      entityId: brand.id,
      tenantId: req.user.tenantId,
      action: "DELETE",
      userId: req.user.id,
      oldValues: brand.toJSON(),
      description: `Brand "${brand.name}" deleted`,
    });

    await brand.destroy();
    res.json({ success: true, message: "Brand deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
