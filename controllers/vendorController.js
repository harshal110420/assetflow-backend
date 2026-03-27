const Vendor = require("../models/Vendor");
const { AuditLog } = require("../models/index");

exports.getAllVendors = async (req, res) => {
  try {
    const vendors = await Vendor.findAll({
      where: { tenantId: req.user.tenantId },
      order: [["name", "ASC"]],
    });
    res.json({ success: true, data: vendors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getVendorById = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!vendor)
      return res
        .status(404)
        .json({ success: false, message: "Vendor not found" });
    res.json({ success: true, data: vendor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createVendor = async (req, res) => {
  try {
    const { name, contactPerson, phone, email, address } = req.body;
    if (!name)
      return res
        .status(400)
        .json({ success: false, message: "Name is required" });

    const vendor = await Vendor.create({
      name,
      contactPerson,
      phone,
      email,
      address,
      tenantId: req.user.tenantId,
      createdBy: req.user.id,
    });

    await AuditLog.create({
      entityType: "Vendor",
      entityId: vendor.id,
      tenantId: req.user.tenantId,
      action: "CREATE",
      userId: req.user.id,
      newValues: vendor.toJSON(),
      description: `Vendor "${vendor.name}" created`,
    });

    res.status(201).json({ success: true, data: vendor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!vendor)
      return res
        .status(404)
        .json({ success: false, message: "Vendor not found" });

    const oldValues = vendor.toJSON();
    await vendor.update(req.body);

    await AuditLog.create({
      entityType: "Vendor",
      entityId: vendor.id,
      tenantId: req.user.tenantId,
      action: "UPDATE",
      userId: req.user.id,
      oldValues,
      newValues: vendor.toJSON(),
      description: `Vendor "${vendor.name}" updated`,
    });

    res.json({ success: true, data: vendor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!vendor)
      return res
        .status(404)
        .json({ success: false, message: "Vendor not found" });

    await AuditLog.create({
      entityType: "Vendor",
      entityId: vendor.id,
      tenantId: req.user.tenantId,
      action: "DELETE",
      userId: req.user.id,
      oldValues: vendor.toJSON(),
      description: `Vendor "${vendor.name}" deleted`,
    });

    await vendor.destroy();
    res.json({ success: true, message: "Vendor deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
