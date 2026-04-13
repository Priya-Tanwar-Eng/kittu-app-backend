const express = require("express");
const router = express.Router();
const {
  sendOTP,
  verifyOTP,
  resendOTP,
  getMe,
  updateProfile,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

// Public routes (login ke pehle)
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp", resendOTP);

// Protected routes (login ke baad)
router.get("/me", protect, getMe);
router.put("/update-profile", protect, updateProfile); // ← naya route

module.exports = router;