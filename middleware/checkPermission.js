const {
  getUserFinalPermissions,
  hasPermission,
} = require("../services/permissionService");

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE FACTORY: Route pe permission check lagao
// Usage: router.post('/assets', protect, checkPermission('asset_master', 'new'), ...)
// ─────────────────────────────────────────────────────────────────────────────
const checkPermission = (menuSlug, action) => {
  return async (req, res, next) => {
    try {
      // Bypass roles — sirf usi tenant ki setting se lo
      let bypassRoles = ["admin"];
      try {
        const Setting = require("../models/Setting");
        const setting = await Setting.findOne({
          where: {
            key: "security.bypassRoles",
            tenantId: req.user.tenantId, // ← ADD tenantId
          },
        });
        if (setting?.value) bypassRoles = JSON.parse(setting.value);
      } catch {
        /* fallback to admin only */
      }

      // Bypass roles check
      if (bypassRoles.includes(req.user?.role)) return next();

      // User ki final permissions — tenantId pass karo
      const permissions = await getUserFinalPermissions(
        req.user.id,
        req.user.roleId,
        req.user.tenantId, // ← ADD tenantId
      );

      // Permission check karo
      if (!hasPermission(permissions, menuSlug, action)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. You don't have permission to perform this action.`,
          required: { menu: menuSlug, action },
        });
      }

      req.userPermissions = permissions;
      next();
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE: Permissions load karke req mein attach karo
// ─────────────────────────────────────────────────────────────────────────────
const loadPermissions = async (req, res, next) => {
  try {
    if (req.user) {
      req.userPermissions = await getUserFinalPermissions(
        req.user.id,
        req.user.roleId,
        req.user.tenantId, // ← ADD tenantId
      );
    }
    next();
  } catch (err) {
    next();
  }
};

module.exports = { checkPermission, loadPermissions };
