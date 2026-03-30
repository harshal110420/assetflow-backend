const User = require("../models/User");
const Asset = require("../models/Asset");
const { Assignment, AuditLog } = require("../models/index");
const { Role } = require("../models/Permission");
const { Op } = require("sequelize");

// ── Helper: roleId se role slug resolve karo — tenantId filter add kiya ───────
async function resolveRole(roleId, fallbackRole, tenantId) {
  // ← ADD tenantId param
  if (!roleId) return fallbackRole || "viewer";
  const role = await Role.findOne({
    where: { id: roleId, tenantId }, // ← ADD tenantId — doosri company ka role na mile
    attributes: ["slug"],
  });
  return role ? role.slug : fallbackRole || "viewer";
}

// ── GET USERS ─────────────────────────────────────────────────────────────────
exports.getUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      role,
      department,
      isActive,
    } = req.query;

    const where = { tenantId: req.user.tenantId }; // ← ADD
    if (search)
      where[Op.or] = [
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    if (role) where.role = role;
    if (department) where.department = department;
    if (isActive !== undefined) where.isActive = isActive === "true";

    const { count, rows } = await User.findAndCountAll({
      where,
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

// ── GET SINGLE USER ───────────────────────────────────────────────────────────
exports.getUser = async (req, res) => {
  try {
    const user = await User.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId }, // ← ADD tenantId
    });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    // const assignedAssets = await Asset.findAll({
    //   where: { assignedToId: req.params.id, tenantId: req.user.tenantId }, // ← ADD tenantId
    //   attributes: ["id", "name", "assetTag", "category", "status"],
    // });

    res.json({
      success: true,
      data: {
        ...user.toJSON(),
        //  assignedAssets
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── CREATE USER ───────────────────────────────────────────────────────────────
exports.createUser = async (req, res) => {
  try {
    // Email unique per tenant — same email doosri company mein allowed
    const existing = await User.findOne({
      where: { email: req.body.email, tenantId: req.user.tenantId }, // ← ADD tenantId
    });
    if (existing)
      return res
        .status(400)
        .json({ success: false, message: "Email already exists" });

    const data = { ...req.body };

    // Role resolve — sirf usi tenant ka role
    if (data.roleId)
      data.role = await resolveRole(data.roleId, data.role, req.user.tenantId); // ← ADD tenantId

    const user = await User.create({
      ...data,
      tenantId: req.user.tenantId, // ← ADD — admin usi tenant mein user banayega
    });
    // createUser — User.create ke baad:
    await AuditLog.create({
      entityType: "User",
      entityId: user.id,
      tenantId: req.user.tenantId,
      action: "CREATE",
      userId: req.user.id,
      newValues: { email: user.email, role: user.role },
      description: `User "${user.firstName} ${user.lastName}" created`,
    });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── UPDATE USER ───────────────────────────────────────────────────────────────
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId }, // ← ADD tenantId
    });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const { password, ...updateData } = req.body; // password change ke liye alag route hai

    // Role resolve — sirf usi tenant ka role
    if (updateData.roleId)
      updateData.role = await resolveRole(
        updateData.roleId,
        updateData.role,
        req.user.tenantId, // ← ADD tenantId
      );

    await user.update(updateData);
    // updateUser — user.update ke baad:
    await AuditLog.create({
      entityType: "User",
      entityId: user.id,
      tenantId: req.user.tenantId,
      action: "UPDATE",
      userId: req.user.id,
      newValues: updateData,
      description: `User "${user.firstName} ${user.lastName}" updated`,
    });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DELETE USER ───────────────────────────────────────────────────────────────
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId }, // ← ADD tenantId
    });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    await user.update({ isActive: false });
    // deleteUser — user.update ke baad:
    await AuditLog.create({
      entityType: "User",
      entityId: user.id,
      tenantId: req.user.tenantId,
      action: "DEACTIVATE",
      userId: req.user.id,
      oldValues: { isActive: true },
      newValues: { isActive: false },
      description: `User "${user.firstName} ${user.lastName}" deactivated`,
    });
    res.json({ success: true, message: "User deactivated" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
