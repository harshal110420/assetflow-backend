const {
  Menu,
  Role,
  RolePermission,
  UserPermission,
  Location,
  UserLocation,
} = require("../models/Permission");
const {
  saveUserPermissions,
  getRolePermissions,
  getUserFinalPermissions,
} = require("../services/permissionService");
const User = require("../models/User");
const { AuditLog } = require("../models/index");

// ── GET ALL MENUS ─────────────────────────────────────────────────────────────
// Menu global hai — tenantId nahi lagta
exports.getMenus = async (req, res) => {
  try {
    const menus = await Menu.findAll({
      where: { isActive: true },
      order: [["order", "ASC"]],
    });
    res.json({ success: true, data: menus });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET USER PERMISSIONS ──────────────────────────────────────────────────────
exports.getUserPermissions = async (req, res) => {
  try {
    // User sirf usi tenant ka hona chahiye
    const user = await User.findOne({
      where: { id: req.params.userId, tenantId: req.user.tenantId }, // ← ADD tenantId
      attributes: ["id", "firstName", "lastName", "email", "role", "roleId"],
    });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    // Menus global hain — no tenantId
    const menus = await Menu.findAll({
      where: { isActive: true },
      order: [["order", "ASC"]],
    });

    // User permissions sirf usi tenant ki
    const userPerms = await UserPermission.findAll({
      where: { userId: req.params.userId, tenantId: req.user.tenantId }, // ← ADD tenantId
    });
    const hasCustomPermissions = userPerms.length > 0;

    let permsMap = {};
    let source = "role";

    if (hasCustomPermissions) {
      userPerms.forEach((p) => {
        permsMap[p.menuId] = p.actions;
      });
      source = "user";
    } else if (user.role === "admin") {
      menus.forEach((menu) => {
        permsMap[menu.id] = {
          view: true,
          new: true,
          edit: true,
          delete: true,
          import: true,
          export: true,
          print: true,
        };
      });
      source = "role";
    } else if (user.roleId) {
      // Role permissions sirf usi tenant ki
      const rolePerms = await RolePermission.findAll({
        where: { roleId: user.roleId, tenantId: req.user.tenantId }, // ← ADD tenantId
      });
      rolePerms.forEach((p) => {
        permsMap[p.menuId] = p.actions;
      });
      source = "role";
    }

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

    res.json({
      success: true,
      data: { user, permissions: result, source, hasCustomPermissions },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── SAVE USER PERMISSIONS ─────────────────────────────────────────────────────
exports.saveUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body;

    // User sirf usi tenant ka hona chahiye
    const user = await User.findOne({
      where: { id: userId, tenantId: req.user.tenantId }, // ← ADD tenantId
    });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const validPermissions = permissions.filter(
      (p) => p.menuId && Object.values(p.actions).some((v) => v === true),
    );

    // permissionService ko tenantId pass karo
    await saveUserPermissions(
      userId,
      validPermissions,
      req.user.id,
      req.user.tenantId,
    ); // ← ADD tenantId

    await AuditLog.create({
      entityType: "User",
      entityId: userId,
      tenantId: req.user.tenantId, // ← ADD
      action: "PERMISSION_UPDATE",
      userId: req.user.id,
      description: `Permissions updated for ${user.firstName} ${user.lastName} by ${req.user.firstName} ${req.user.lastName}`,
    });

    res.json({ success: true, message: "Permissions saved successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── RESET USER PERMISSIONS ────────────────────────────────────────────────────
exports.resetUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;

    // Sirf usi tenant ke user ki permissions delete karo
    await UserPermission.destroy({
      where: { userId, tenantId: req.user.tenantId }, // ← ADD tenantId
    });
    await AuditLog.create({
      entityType: "User",
      entityId: userId,
      tenantId: req.user.tenantId,
      action: "PERMISSION_RESET",
      userId: req.user.id,
      description: `Permissions reset to role defaults for user ${userId}`,
    });

    res.json({ success: true, message: "Permissions reset to role defaults" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET MY PERMISSIONS ────────────────────────────────────────────────────────
exports.getMyPermissions = async (req, res) => {
  try {
    // permissionService ko tenantId pass karo
    const permissions = await getUserFinalPermissions(
      req.user.id,
      req.user.roleId,
      req.user.tenantId, // ← ADD tenantId
    );

    if (req.user.role === "admin") {
      const menus = await Menu.findAll({
        where: { isActive: true },
        order: [["order", "ASC"]],
      });
      const adminPerms = {};
      menus.forEach((menu) => {
        adminPerms[menu.slug] = {
          menuId: menu.id,
          menuName: menu.name,
          icon: menu.icon,
          order: menu.order,
          actions: {
            view: true,
            new: true,
            edit: true,
            delete: true,
            import: true,
            export: true,
          },
        };
      });
      return res.json({ success: true, data: adminPerms, isAdmin: true });
    }

    res.json({ success: true, data: permissions, isAdmin: false });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── LOCATIONS CRUD ────────────────────────────────────────────────────────────
exports.getLocations = async (req, res) => {
  try {
    // Sirf usi tenant ki locations
    const where = {
      tenantId: req.user.tenantId, // ← ADD
      ...(req.user.role !== "admin" && { isActive: true }),
    };
    const locations = await Location.findAll({
      where,
      order: [["name", "ASC"]],
    });
    res.json({ success: true, data: locations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createLocation = async (req, res) => {
  try {
    const { name, code, address } = req.body;
    if (!name)
      return res
        .status(400)
        .json({ success: false, message: "Location name required" });

    const location = await Location.create({
      name,
      code,
      address,
      tenantId: req.user.tenantId, // ← ADD
      createdBy: req.user.id,
    });
    await AuditLog.create({
      entityType: "Location",
      entityId: location.id,
      tenantId: req.user.tenantId,
      action: "CREATE",
      userId: req.user.id,
      newValues: location.toJSON(),
      description: `Location "${name}" created`,
    });
    res
      .status(201)
      .json({ success: true, data: location, message: "Location created" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateLocation = async (req, res) => {
  try {
    const location = await Location.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId }, // ← ADD tenantId
    });
    if (!location)
      return res
        .status(404)
        .json({ success: false, message: "Location not found" });

    await location.update(req.body);
    // updateLocation — update ke baad add karo:
    await AuditLog.create({
      entityType: "Location",
      entityId: location.id,
      tenantId: req.user.tenantId,
      action: "UPDATE",
      userId: req.user.id,
      newValues: location.toJSON(),
      description: `Location "${location.name}" updated`,
    });
    res.json({ success: true, data: location, message: "Location updated" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteLocation = async (req, res) => {
  try {
    const location = await Location.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId }, // ← ADD tenantId
    });
    if (!location)
      return res
        .status(404)
        .json({ success: false, message: "Location not found" });

    await location.update({ isActive: false });
    // deleteLocation — update ke baad add karo:
    await AuditLog.create({
      entityType: "Location",
      entityId: location.id,
      tenantId: req.user.tenantId,
      action: "DEACTIVATE",
      userId: req.user.id,
      description: `Location "${location.name}" deactivated`,
    });
    res.json({ success: true, message: "Location deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── USER LOCATIONS ────────────────────────────────────────────────────────────
exports.getUserLocations = async (req, res) => {
  try {
    const userLocations = await UserLocation.findAll({
      where: {
        userId: req.params.userId,
        tenantId: req.user.tenantId, // ← ADD tenantId
      },
      include: [{ model: Location, attributes: ["id", "name", "code"] }],
    });
    res.json({ success: true, data: userLocations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.saveUserLocations = async (req, res) => {
  try {
    const { userId } = req.params;
    const { locationIds } = req.body;

    // Sirf usi tenant ka user update karo
    const user = await User.findOne({
      where: { id: userId, tenantId: req.user.tenantId }, // ← ADD tenantId
    });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    // DELETE + INSERT — tenantId filter karo
    await UserLocation.destroy({
      where: { userId, tenantId: req.user.tenantId }, // ← ADD tenantId
    });

    if (locationIds && locationIds.length > 0) {
      await UserLocation.bulkCreate(
        locationIds.map((locationId) => ({
          userId,
          locationId,
          tenantId: req.user.tenantId, // ← ADD
          createdBy: req.user.id,
        })),
      );
    }

    res.json({ success: true, message: "User locations updated" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── MENU MANAGEMENT (Admin only) ──────────────────────────────────────────────
// Menus global hain — tenant filter nahi lagta

exports.getAllMenus = async (req, res) => {
  try {
    const menus = await Menu.findAll({ order: [["order", "ASC"]] });
    res.json({ success: true, data: menus });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createMenu = async (req, res) => {
  try {
    const { name, slug, icon, order, availableActions } = req.body;
    if (!name || !slug)
      return res
        .status(400)
        .json({ success: false, message: "Name and slug required" });

    const existing = await Menu.findOne({ where: { slug } });
    if (existing)
      return res
        .status(400)
        .json({ success: false, message: "Slug already exists" });

    const menu = await Menu.create({
      name,
      slug,
      icon,
      order: order || 99,
      availableActions: availableActions || ["view"],
      isActive: true,
    });
    res.status(201).json({
      success: true,
      data: menu,
      message: "Menu created successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateMenu = async (req, res) => {
  try {
    const menu = await Menu.findByPk(req.params.id);
    if (!menu)
      return res
        .status(404)
        .json({ success: false, message: "Menu not found" });

    const { name, icon, order, availableActions, isActive } = req.body;
    await menu.update({ name, icon, order, availableActions, isActive });
    res.json({
      success: true,
      data: menu,
      message: "Menu updated successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteMenu = async (req, res) => {
  try {
    const menu = await Menu.findByPk(req.params.id);
    if (!menu)
      return res
        .status(404)
        .json({ success: false, message: "Menu not found" });

    const SYSTEM_SLUGS = [
      "dashboard",
      "asset_master",
      "maintenance",
      "approvals",
      "reports",
      "users",
      "roles",
      "locations",
      "settings",
    ];
    if (SYSTEM_SLUGS.includes(menu.slug))
      return res
        .status(403)
        .json({ success: false, message: "System menus cannot be deleted" });

    await menu.destroy();
    res.json({ success: true, message: "Menu deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
