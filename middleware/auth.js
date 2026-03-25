// middleware/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token)
      return res
        .status(401)
        .json({ success: false, message: "Not authorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // decoded mein ab { id, tenantId } dono hain
    const user = await User.findByPk(decoded.id);
    if (!user || !user.isActive)
      return res
        .status(401)
        .json({ success: false, message: "User not found or inactive" });

    // ── req.user set karo ─────────────────────────────────────────────────
    // user.tenantId already DB se aa raha hai — koi extra kaam nahi
    req.user = user;

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

const authorize =
  (...roles) =>
  (req, res, next) => {
    if (req.user.role === "admin") return next();
    if (roles.includes(req.user.role)) return next();
    return res.status(403).json({
      success: false,
      message: `Access denied. Required role: ${roles.join(" or ")}`,
    });
  };

module.exports = { protect, authorize };
