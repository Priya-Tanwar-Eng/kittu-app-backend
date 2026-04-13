// backend/controllers/authController.js
const ZaptoUser = require("../models/ZaptoUser");
const jwt       = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",  // ✅ IPv4 force karo
  port: 465,
  secure: true,
  family: 4,               // ✅ IPv4 only — Render free tier fix
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  connectionTimeout: 8000,
  greetingTimeout:   8000,
  socketTimeout:     8000,
});

transporter.verify((error) => {
  if (error) {
    console.error("❌ Gmail connection failed:", error.message);
  } else {
    console.log("✅ Gmail service ready —", process.env.GMAIL_USER);
  }
});

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

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

// POST /api/auth/send-otp
exports.sendOTP = async (req, res) => {
  try {
    const { phone, email } = req.body;

    if (!phone || !email) {
      return res.status(400).json({ success: false, message: "Phone number aur email dono required hain" });
    }

    const phoneRegex = /^\+?[1-9]\d{9,14}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ success: false, message: "Invalid phone number. Example: +919876543210" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email address" });
    }

    const otp       = generateOTP();
    const otpExpiry = new Date(Date.now() + 300000);

    let user = await ZaptoUser.findOne({ phone });
    if (!user) {
      user = await ZaptoUser.findOne({ email: email.toLowerCase().trim() });
      if (user) {
        user.phone = phone;
      } else {
        user = new ZaptoUser({ phone });
      }
    }

    user.email = email.toLowerCase().trim();
    user.otp   = { code: otp, expiresAt: otpExpiry, attempts: 0 };
    await user.save();

    const result = await sendOTPEmail(email, otp, phone);

    // ✅ Response already gaya toh dobara mat bhejo
    if (res.headersSent) return;

    if (!result.success) {
      return res.status(500).json({ success: false, message: "OTP email nahi bhej paaye. Gmail settings check karo." });
    }

    return res.status(200).json({ success: true, message: `OTP bheja gaya ${email} pe! Inbox check karo.` });

  } catch (error) {
    console.error("sendOTP error:", error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: "Server error. Please try again." });
    }
  }
};

// POST /api/auth/verify-otp
exports.verifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: "Phone number aur OTP required hain" });
    }

    if (otp.length !== 6) {
      return res.status(400).json({ success: false, message: "OTP 6 digits ka hona chahiye" });
    }

    const user = await ZaptoUser.findOne({ phone });
    if (!user) {
      return res.status(404).json({ success: false, message: "User nahi mila. Pehle OTP request karo." });
    }

    user.otp.attempts += 1;
    const otpCheck = user.isOtpValid(otp);

    if (!otpCheck.valid) {
      await user.save();
      return res.status(400).json({ success: false, message: otpCheck.message });
    }

    user.isVerified = true;
    user.lastLogin  = new Date();
    user.clearOtp();
    await user.save();

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: "Login successful!",
      token,
      user: {
        id:             user._id,
        phone:          user.phone,
        name:           user.name,
        email:          user.email,
        profilePicture: user.profilePicture,
        isVerified:     user.isVerified,
        isAdmin:        user.isAdmin,
        lastLogin:      user.lastLogin,
      },
    });

  } catch (error) {
    console.error("verifyOTP error:", error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: "Server error. Please try again." });
    }
  }
};

// POST /api/auth/resend-otp
exports.resendOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: "Phone number required hai" });
    }

    const user = await ZaptoUser.findOne({ phone });
    if (!user || !user.email) {
      return res.status(404).json({ success: false, message: "User nahi mila. Pehle send-otp karo." });
    }

    if (user.otp?.expiresAt) {
      const timeLeft = user.otp.expiresAt - Date.now();
      if (timeLeft > 240000) {
        return res.status(429).json({ success: false, message: "Please 1 minute wait karo naya OTP ke liye." });
      }
    }

    const otp       = generateOTP();
    const otpExpiry = new Date(Date.now() + 300000);

    user.otp = { code: otp, expiresAt: otpExpiry, attempts: 0 };
    await user.save();

    const result = await sendOTPEmail(user.email, otp, phone);

    if (res.headersSent) return;

    if (!result.success) {
      return res.status(500).json({ success: false, message: "OTP resend nahi ho paya." });
    }

    return res.status(200).json({ success: true, message: `OTP dobara bheja gaya ${user.email} pe!` });

  } catch (error) {
    console.error("resendOTP error:", error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: "Server error. Please try again." });
    }
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await ZaptoUser.findById(req.user.id).select("-otp -__v");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("getMe error:", error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

// PUT /api/auth/update-profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: "Name kam se kam 2 characters ka hona chahiye" });
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
        return res.status(400).json({ success: false, message: "Yeh email already kisi aur account se linked hai" });
      }
    }

    const encodedName   = encodeURIComponent(name.trim());
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodedName}&background=7C3AED&color=fff&size=200&bold=true&rounded=true`;

    const user = await ZaptoUser.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

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
        id:             user._id,
        phone:          user.phone,
        name:           user.name,
        email:          user.email,
        profilePicture: user.profilePicture,
        isVerified:     user.isVerified,
        isAdmin:        user.isAdmin,
      },
    });

  } catch (error) {
    console.error("updateProfile error:", error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: "Server error." });
    }
  }
};