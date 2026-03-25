const { Role, RolePermission, Menu } = require("../models/Permission");
const { AuditLog } = require("../models/index");

// ── GET ALL ROLES ─────────────────────────────────────────────────────────────
exports.getRoles = async (req, res) => {
  try {
    const roles = await Role.findAll({
      where: { isActive: true, tenantId: req.user.tenantId }, // ← ADD tenantId
      order: [["createdAt", "ASC"]],
    });
    res.json({ success: true, data: roles });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET ROLE WITH PERMISSIONS ─────────────────────────────────────────────────
exports.getRolePermissions = async (req, res) => {
  try {
    // Role sirf usi tenant ka hona chahiye
    const role = await Role.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId }, // ← ADD tenantId
    });
    if (!role)
      return res
        .status(404)
        .json({ success: false, message: "Role not found" });

    // Menus global hain — no tenantId
    const menus = await Menu.findAll({
      where: { isActive: true },
      order: [["order", "ASC"]],
    });

    // Role permissions sirf usi tenant ki
    const rolePerms = await RolePermission.findAll({
      where: { roleId: req.params.id, tenantId: req.user.tenantId }, // ← ADD tenantId
    });

    const permsMap = {};
    rolePerms.forEach((p) => {
      permsMap[p.menuId] = p.actions;
    });

    const result = menus.map((menu) => ({
      menuId: menu.id,
      menuName: menu.name,
      slug: menu.slug,
      icon: menu.icon,
      order: menu.order,
      availableActions: menu.availableActions,
      actions: permsMap[menu.id] || {
        view: false,
        new: false,
        edit: false,
        delete: false,
        import: false,
        export: false,
      },
    }));

    res.json({ success: true, data: { role, permissions: result } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── CREATE ROLE ───────────────────────────────────────────────────────────────
exports.createRole = async (req, res) => {
  try {
    const { name, description, permissions = [] } = req.body;
    if (!name)
      return res
        .status(400)
        .json({ success: false, message: "Role name required" });

    const slug = name
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

    // Slug unique per tenant — doosri company mein same slug allowed
    const existing = await Role.findOne({
      where: { slug, tenantId: req.user.tenantId }, // ← ADD tenantId
    });
    if (existing)
      return res
        .status(400)
        .json({ success: false, message: "Role already exists" });

    const role = await Role.create({
      name,
      slug,
      description,
      tenantId: req.user.tenantId, // ← ADD
    });

    // Permissions save karo — tenantId inject karo
    if (permissions.length > 0) {
      await RolePermission.bulkCreate(
        permissions
          .filter(
            (p) => p.menuId && Object.values(p.actions).some((v) => v === true),
          )
          .map((p) => ({
            roleId: role.id,
            menuId: p.menuId,
            tenantId: req.user.tenantId, // ← ADD
            actions: p.actions,
          })),
      );
    }

    await AuditLog.create({
      entityType: "Role",
      entityId: role.id,
      tenantId: req.user.tenantId, // ← ADD
      action: "CREATE",
      userId: req.user.id,
      description: `Role "${name}" created`,
    });

    res.status(201).json({
      success: true,
      data: role,
      message: "Role created successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── UPDATE ROLE PERMISSIONS ───────────────────────────────────────────────────
exports.updateRolePermissions = async (req, res) => {
  try {
    const { name, description, permissions = [] } = req.body;

    // Role sirf usi tenant ka hona chahiye
    const role = await Role.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId }, // ← ADD tenantId
    });
    if (!role)
      return res
        .status(404)
        .json({ success: false, message: "Role not found" });
    if (role.isSystem && name)
      return res.status(400).json({
        success: false,
        message: "System role name cannot be changed",
      });

    if (name || description !== undefined) {
      await role.update({
        name: name || role.name,
        description: description ?? role.description,
      });
    }

    // DELETE old + INSERT new — tenantId filter karo
    await RolePermission.destroy({
      where: { roleId: role.id, tenantId: req.user.tenantId }, // ← ADD tenantId
    });

    if (permissions.length > 0) {
      await RolePermission.bulkCreate(
        permissions
          .filter(
            (p) => p.menuId && Object.values(p.actions).some((v) => v === true),
          )
          .map((p) => ({
            roleId: role.id,
            menuId: p.menuId,
            tenantId: req.user.tenantId, // ← ADD
            actions: p.actions,
          })),
      );
    }

    await AuditLog.create({
      entityType: "Role",
      entityId: role.id,
      tenantId: req.user.tenantId, // ← ADD
      action: "UPDATE",
      userId: req.user.id,
      description: `Role "${role.name}" permissions updated`,
    });

    res.json({ success: true, message: "Role updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DELETE ROLE ───────────────────────────────────────────────────────────────
exports.deleteRole = async (req, res) => {
  try {
    // Role sirf usi tenant ka hona chahiye
    const role = await Role.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId }, // ← ADD tenantId
    });
    if (!role)
      return res
        .status(404)
        .json({ success: false, message: "Role not found" });
    if (role.isSystem)
      return res
        .status(400)
        .json({ success: false, message: "System role cannot be deleted" });

    // Sirf usi tenant ke role permissions delete karo
    await RolePermission.destroy({
      where: { roleId: role.id, tenantId: req.user.tenantId }, // ← ADD tenantId
    });

    await role.update({ isActive: false });
    // role.update ke baad add karo:
    await AuditLog.create({
      entityType: "Role",
      entityId: role.id,
      tenantId: req.user.tenantId,
      action: "DELETE",
      userId: req.user.id,
      oldValues: role.toJSON(),
      description: `Role "${role.name}" deleted`,
    });
    res.json({ success: true, message: "Role deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
