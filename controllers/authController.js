// backend/controllers/authController.js
const ZaptoUser = require("../models/ZaptoUser");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

// =============================================
// Gmail Transporter Setup
// .env mein ye dono chahiye:
//   GMAIL_USER=tumhara@gmail.com
//   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
// =============================================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Startup pe check karo Gmail ready hai ya nahi
transporter.verify((error) => {
  if (error) {
    console.error("❌ Gmail connection failed:", error.message);
    console.log("   .env mein GMAIL_USER aur GMAIL_APP_PASSWORD check karo");
  } else {
    console.log("✅ Gmail service ready —", process.env.GMAIL_USER);
  }
});

// =============================================
// Helper: 6 digit OTP generate karo
// =============================================
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// =============================================
// Helper: JWT Token banana
// =============================================
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

// =============================================
// Helper: OTP Email bhejo
// =============================================
const sendOTPEmail = async (email, otp, phone) => {
  try {
    await transporter.sendMail({
      from: `"Kittu App 🛒" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Your Kittu Login OTP",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <h2 style="color: #7C3AED; margin-bottom: 4px;">🛒 Kittu App</h2>
          <p style="color: #6b7280; font-size: 14px;">10 Minute Grocery Delivery</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
          <p style="font-size: 15px; color: #111827;">Phone <strong>+91 ${phone}</strong> ke liye OTP:</p>
          <div style="background: #f3f0ff; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 36px; font-weight: bold; color: #7C3AED; letter-spacing: 10px;">${otp}</span>
          </div>
          <p style="color: #6b7280; font-size: 13px;">⏱ Yeh OTP <strong>5 minutes</strong> mein expire ho jayega.</p>
          <p style="color: #ef4444; font-size: 13px;">⚠️ Kisi ke saath share mat karo.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
          <p style="color: #9ca3af; font-size: 12px;">Agar aapne request nahi kiya toh is email ko ignore karo.</p>
        </div>
      `,
    });
    console.log(`✅ OTP sent to ${email} for phone ${phone}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Email sending failed:", error.message);
    return { success: false, error: error.message };
  }
};

// =============================================
// @route   POST /api/auth/send-otp
// @desc    Phone + Email leke OTP email pe bhejo
// @access  Public
// =============================================
exports.sendOTP = async (req, res) => {
  try {
    const { phone, email } = req.body;

    // Validation
    if (!phone || !email) {
      return res.status(400).json({
        success: false,
        message: "Phone number aur email dono required hain",
      });
    }

    // Phone validate karo
    const phoneRegex = /^\+?[1-9]\d{9,14}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number. Example: +919876543210",
      });
    }

    // Email validate karo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address",
      });
    }

    // OTP generate karo
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 300000); // 5 min

    // ✅ Phone se dhundo — duplicate nahi banega
    let user = await ZaptoUser.findOne({ phone });

    // Phone nahi mila — email se try karo (same person alag phone?)
    if (!user) {
      user = await ZaptoUser.findOne({ email: email.toLowerCase().trim() });
      if (user) {
        // Email match kiya — phone update karo
        user.phone = phone;
      } else {
        // Bilkul naya user
        user = new ZaptoUser({ phone });
      }
    }

    // Email save karo
    user.email = email.toLowerCase().trim();

    // OTP save karo
    user.otp = {
      code: otp,
      expiresAt: otpExpiry,
      attempts: 0,
    };

    await user.save();

    // Email bhejo
    const result = await sendOTPEmail(email, otp, phone);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: "OTP email nahi bhej paaye. Gmail settings check karo.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `OTP bheja gaya ${email} pe! Inbox check karo.`,
    });

  } catch (error) {
    console.error("sendOTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again.",
    });
  }
};

// =============================================
// @route   POST /api/auth/verify-otp
// @desc    OTP verify karo aur login karo
// @access  Public
// =============================================
exports.verifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone number aur OTP required hain",
      });
    }

    if (otp.length !== 6) {
      return res.status(400).json({
        success: false,
        message: "OTP 6 digits ka hona chahiye",
      });
    }

    const user = await ZaptoUser.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User nahi mila. Pehle OTP request karo.",
      });
    }

    user.otp.attempts += 1;

    const otpCheck = user.isOtpValid(otp);

    if (!otpCheck.valid) {
      await user.save();
      return res.status(400).json({
        success: false,
        message: otpCheck.message,
      });
    }

    // ✅ OTP sahi hai!
    user.isVerified = true;
    user.lastLogin = new Date();
    user.clearOtp();

    await user.save();

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: "Login successful!",
      token,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        isVerified: user.isVerified,
        isAdmin: user.isAdmin,   // ✅ isAdmin bhi bhejo
        lastLogin: user.lastLogin,
      },
    });

  } catch (error) {
    console.error("verifyOTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again.",
    });
  }
};

// =============================================
// @route   POST /api/auth/resend-otp
// @desc    OTP dobara bhejo
// @access  Public
// =============================================
exports.resendOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number required hai",
      });
    }

    const user = await ZaptoUser.findOne({ phone });

    if (!user || !user.email) {
      return res.status(404).json({
        success: false,
        message: "User nahi mila. Pehle send-otp karo.",
      });
    }

    // Rate limiting — 1 minute wait
    if (user.otp?.expiresAt) {
      const timeLeft = user.otp.expiresAt - Date.now();
      if (timeLeft > 240000) { // 4 min bache hain matlab abhi abhi bheja tha
        return res.status(429).json({
          success: false,
          message: "Please 1 minute wait karo naya OTP ke liye.",
        });
      }
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 300000);

    user.otp = { code: otp, expiresAt: otpExpiry, attempts: 0 };
    await user.save();

    const result = await sendOTPEmail(user.email, otp, phone);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: "OTP resend nahi ho paya.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `OTP dobara bheja gaya ${user.email} pe!`,
    });

  } catch (error) {
    console.error("resendOTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again.",
    });
  }
};

// =============================================
// @route   GET /api/auth/me
// =============================================
exports.getMe = async (req, res) => {
  try {
    const user = await ZaptoUser.findById(req.user.id).select("-otp -__v");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("getMe error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =============================================
// @route   PUT /api/auth/update-profile
// =============================================
exports.updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Name kam se kam 2 characters ka hona chahiye",
      });
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: "Valid email enter karo" });
      }

      const existingUser = await ZaptoUser.findOne({
        email: email.toLowerCase(),
        _id: { $ne: req.user.id },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Yeh email already kisi aur account se linked hai",
        });
      }
    }

    const encodedName = encodeURIComponent(name.trim());
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodedName}&background=7C3AED&color=fff&size=200&bold=true&rounded=true`;

    const user = await ZaptoUser.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.name = name.trim();
    if (email) user.email = email.toLowerCase().trim();

    if (!user.profilePicture || user.profilePicture.includes("ui-avatars.com")) {
      user.profilePicture = defaultAvatar;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile update ho gaya!",
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        isVerified: user.isVerified,
      },
    });

  } catch (error) {
    console.error("updateProfile error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};