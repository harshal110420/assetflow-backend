const { AsyncLocalStorage } = require("async_hooks");

// Node.js built-in — koi package install nahi karna
const tenantStorage = new AsyncLocalStorage();

/**
 * Current request ka tenantId return karta hai
 * Middleware ne set kiya hoga ye
 */
const getTenantId = () => {
  const store = tenantStorage.getStore();
  if (!store?.tenantId) {
    throw new Error("Tenant context not set — tenantMiddleware missing?");
  }
  return store.tenantId;
};

/**
 * Safe version — throws nahi karta
 * Seeders aur scripts ke liye use karo
 */
const getTenantIdSafe = () => {
  const store = tenantStorage.getStore();
  return store?.tenantId || null;
};

/**
 * Manually tenant context set karo
 * Seeders / cron jobs mein use karo
 *
 * Usage:
 *   await runWithTenant("tenant-uuid-here", async () => {
 *     await Asset.findAll(); // automatically tenant filtered
 *   });
 */
const runWithTenant = (tenantId, fn) => {
  return tenantStorage.run({ tenantId }, fn);
};

module.exports = { tenantStorage, getTenantId, getTenantIdSafe, runWithTenant };
