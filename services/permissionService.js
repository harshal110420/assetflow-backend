const {
  Menu,
  Role,
  RolePermission,
  UserPermission,
} = require("../models/Permission");

// ─────────────────────────────────────────────────────────────────────────────
// CORE LOGIC: User ki final permissions fetch karo
// Rule 1: user_permissions EMPTY     → role se pado
// Rule 2: user_permissions HAS DATA  → ONLY wahi use karo
//         Missing menus = ALL FALSE  (role se bleed nahi hoga)
// tenantId parameter add kiya — sirf usi tenant ki permissions
// ─────────────────────────────────────────────────────────────────────────────
async function getUserFinalPermissions(userId, roleId, tenantId) {
  // ← ADD tenantId
  // Step 1 — User specific permissions check karo — sirf usi tenant ki
  const userPerms = await UserPermission.findAll({
    where: { userId, tenantId }, // ← ADD tenantId
    include: [
      {
        model: Menu,
        attributes: ["id", "name", "slug", "icon", "order", "availableActions"],
      },
    ],
  });

  console.log(
    `[PERM DEBUG] userId=${userId}, tenantId=${tenantId}, userPerms count=${userPerms.length}`,
  );

  // Step 2 — Custom permissions hain?
  if (userPerms.length > 0) {
    const result = formatPermissions(userPerms);
    console.log(`[PERM DEBUG] Custom perms found. Menus:`, Object.keys(result));
    return result;
  }

  // Step 3 — Koi custom permissions nahi → role se pado
  console.log(`[PERM DEBUG] No custom perms, using roleId=${roleId}`);
  if (roleId) {
    const rolePerms = await RolePermission.findAll({
      where: { roleId, tenantId }, // ← ADD tenantId
      include: [
        {
          model: Menu,
          attributes: [
            "id",
            "name",
            "slug",
            "icon",
            "order",
            "availableActions",
          ],
        },
      ],
    });
    const result = formatPermissions(rolePerms);
    console.log(`[PERM DEBUG] Role perms menus:`, Object.keys(result));
    return result;
  }

  return {};
}

// Permissions ko clean format mein convert karo
function formatPermissions(perms) {
  const result = {};
  perms.forEach((p) => {
    if (p.Menu) {
      result[p.Menu.slug] = {
        menuId: p.Menu.id,
        menuName: p.Menu.name,
        icon: p.Menu.icon,
        order: p.Menu.order,
        actions: p.actions,
      };
    }
  });
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK: Specific action allowed hai ya nahi
// ─────────────────────────────────────────────────────────────────────────────
function hasPermission(permissions, menuSlug, action) {
  if (!permissions || !permissions[menuSlug]) return false;
  return permissions[menuSlug].actions[action] === true;
}

// ─────────────────────────────────────────────────────────────────────────────
// SAVE: User ki custom permissions save karo (DELETE + INSERT)
// tenantId parameter add kiya
// ─────────────────────────────────────────────────────────────────────────────
async function saveUserPermissions(
  userId,
  permissionsArray,
  adminId,
  tenantId,
) {
  // ← ADD tenantId
  const sequelize = require("../config/database");

  await sequelize.transaction(async (t) => {
    // Sirf usi tenant ki permissions delete karo
    await UserPermission.destroy({
      where: { userId, tenantId }, // ← ADD tenantId
      transaction: t,
    });

    if (permissionsArray.length > 0) {
      await UserPermission.bulkCreate(
        permissionsArray.map((p) => ({
          userId,
          menuId: p.menuId,
          tenantId, // ← ADD tenantId
          actions: p.actions,
          createdBy: adminId,
          modifiedBy: adminId,
        })),
        { transaction: t },
      );
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET ROLE PERMISSIONS — tenantId parameter add kiya
// ─────────────────────────────────────────────────────────────────────────────
async function getRolePermissions(roleId, tenantId) {
  // ← ADD tenantId
  const rolePerms = await RolePermission.findAll({
    where: { roleId, tenantId }, // ← ADD tenantId
    include: [
      {
        model: Menu,
        attributes: ["id", "name", "slug", "icon", "order", "availableActions"],
      },
    ],
  });
  return formatPermissions(rolePerms);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL MENUS — global, tenantId nahi
// ─────────────────────────────────────────────────────────────────────────────
async function getAllMenus() {
  return Menu.findAll({ where: { isActive: true }, order: [["order", "ASC"]] });
}

module.exports = {
  getUserFinalPermissions,
  hasPermission,
  saveUserPermissions,
  getRolePermissions,
  getAllMenus,
  formatPermissions,
};
