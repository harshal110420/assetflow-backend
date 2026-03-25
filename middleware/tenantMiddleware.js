// middleware/tenantMiddleware.js
// ─────────────────────────────────────────────────────────────────────────────
// Ye middleware authMiddleware ke BAAD lagao
// authMiddleware pehle JWT verify karta hai → req.user set karta hai
// Phir ye middleware tenantId uthata hai aur AsyncLocalStorage mein set karta hai
// ─────────────────────────────────────────────────────────────────────────────

const { tenantStorage } = require("../context/tenantContext");

const tenantMiddleware = (req, res, next) => {
  // req.user authMiddleware ne set kiya hoga
  const tenantId = req.user?.tenantId;

  if (!tenantId) {
    return res.status(401).json({
      success: false,
      message: "Tenant context missing — invalid token",
    });
  }

  // Poori request lifecycle ke liye tenant context set karo
  // Ab koi bhi model query kare — auto filter lagega
  tenantStorage.run({ tenantId }, next);
};

module.exports = tenantMiddleware;
