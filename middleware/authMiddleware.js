// backend/middleware/authMiddleware.js
const jwt  = require("jsonwebtoken");
const User = require("../models/ZaptoUser");

// ─── protect ──────────────────────────────────────────────────
// Sirf logged-in users allow karo
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: "Access denied. Please login first." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id).select("-otp");

    if (!user) {
      return res.status(401).json({ success: false, message: "User no longer exists." });
    }

    req.user = user;
    next();

  } catch (error) {
    if (error.name === "JsonWebTokenError") return res.status(401).json({ success: false, message: "Invalid token. Please login again." });
    if (error.name === "TokenExpiredError") return res.status(401).json({ success: false, message: "Token expired. Please login again." });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── adminOnly ────────────────────────────────────────────────
// protect ke BAAD use karo — sirf isAdmin:true users allow karo
const adminOnly = (req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({
      success: false,
      message: "Access forbidden. Admin only.",
    });
  }
  next();
};

module.exports = { protect, adminOnly };