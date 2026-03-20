// backend/models/ZaptoUser.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      trim: true,
      match: [/^\+?[1-9]\d{9,14}$/, "Please enter a valid phone number"],
    },
    name: {
      type: String,
      trim: true,
      default: null,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    profilePicture: {
      type: String,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // ✅ Admin flag — sirf MongoDB se manually true karo
    // Koi bhi API se isAdmin set NAHI kar sakta
    isAdmin: {
      type: Boolean,
      default: false,
    },

    otp: {
      code:      { type: String, default: null },
      expiresAt: { type: Date,   default: null },
      attempts:  { type: Number, default: 0    },
    },

    lastLogin: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// OTP verify karne ka method
userSchema.methods.isOtpValid = function (enteredOtp) {
  if (!this.otp.code || !this.otp.expiresAt) {
    return { valid: false, message: "OTP not found. Please request a new one." };
  }
  if (new Date() > this.otp.expiresAt) {
    return { valid: false, message: "OTP has expired. Please request a new one." };
  }
  if (this.otp.attempts >= 3) {
    return { valid: false, message: "Too many wrong attempts. Please request a new OTP." };
  }
  if (this.otp.code !== enteredOtp) {
    return { valid: false, message: "Invalid OTP. Please try again." };
  }
  return { valid: true, message: "OTP verified successfully!" };
};

// OTP clear karne ka method
userSchema.methods.clearOtp = function () {
  this.otp.code      = null;
  this.otp.expiresAt = null;
  this.otp.attempts  = 0;
};

const ZaptoUser = mongoose.model("ZaptoUser", userSchema);
module.exports = ZaptoUser;