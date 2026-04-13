// backend/server.js
const express    = require("express");
const mongoose   = require("mongoose");
const cors       = require("cors");
const compression = require("compression");
const rateLimit  = require("express-rate-limit");
require("dotenv").config();

const authRoutes    = require("./routes/auth");
const productRoutes = require("./routes/products");
const orderRoutes   = require("./routes/orders");

const app = express();

// ─── 1. CORS — sabse pehle ────────────────────────────────────

const corsOptions = {
  origin: process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",")
    : ["http://localhost:5173", "http://localhost:4173", "http://127.0.0.1:5173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));

// ─── 2. Compression ───────────────────────────────────────────
app.use(compression({ level: 6, threshold: 1024 }));

// ─── 3. Rate Limiting ─────────────────────────────────────────
// 1000 users ke liye limits increase kiye
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,                  // ✅ 200 → 500 (1000 users handle karega)
  message: { success: false, message: "Bahut zyada requests! Thoda wait karo." },
  standardHeaders: true,
  legacyHeaders: false,
  // ✅ Skip successful GETs — products fetch rate limit mein count nahi hoga
  skip: (req) => req.method === "GET" && req.path.startsWith("/api/products"),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,                   // ✅ Production value — OTP abuse rokta hai
  message: { success: false, message: "Bahut zyada login attempts! 15 min baad try karo." },
  skipSuccessfulRequests: true, // ✅ Successful logins count nahi honge
});

app.use("/api/", limiter);
app.use("/api/auth/send-otp",   authLimiter);
app.use("/api/auth/verify-otp", authLimiter);

// ─── 4. Body Parsers ──────────────────────────────────────────
// ✅ Limit 10mb → 2mb — unnecessary large payloads reject
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ─── 5. Cache Headers ─────────────────────────────────────────
app.use("/api/products", (req, res, next) => {
  if (req.method === "GET") {
    res.set("Cache-Control", "public, max-age=120, stale-while-revalidate=60");
  }
  next();
});

// ─── 6. Request Timeout ───────────────────────────────────────
// ✅ 10 sec mein response nahi aaya toh 503 — hung requests rokta hai
app.use((req, res, next) => {
  res.setTimeout(10000, () => {
    res.status(503).json({ success: false, message: "Request timeout. Please try again." });
  });
  next();
});

// ─── 7. Routes ────────────────────────────────────────────────
app.use("/api/auth",     authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders",   orderRoutes);
app.use("/api/img",      require("./routes/imageProxy"));

app.get("/", (req, res) => {
  res.json({ success: true, message: "🚀 Kittu Backend Running!" });
});

// ─── 8. Global Error Handler ──────────────────────────────────
// ✅ Unhandled errors server crash nahi karenge
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err.message);
  res.status(500).json({ success: false, message: "Server error. Please try again." });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─── 9. MongoDB Connection — Optimized for 1000 users ─────────
const PORT        = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/kittu-db";

mongoose.connect(MONGODB_URI, {
  // ✅ Connection Pool — 1000 users ke liye
  maxPoolSize: 20,        // ek saath 20 MongoDB connections (default 5 tha)
  minPoolSize: 5,         // minimum 5 connections ready rakho
  socketTimeoutMS: 45000, // 45 sec mein response nahi aaya toh close
  serverSelectionTimeoutMS: 5000, // 5 sec mein MongoDB nahi mila toh error
  heartbeatFrequencyMS: 10000,    // har 10 sec mein connection check
})
.then(() => {
  console.log("✅ MongoDB connected! Pool size: 20");
  app.listen(PORT, () => {
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`📦 Environment: ${process.env.NODE_ENV || "development"}`);
  });
})
.catch((err) => {
  console.error("❌ MongoDB error:", err.message);
  process.exit(1);
});

// ✅ Graceful shutdown — server band ho toh connections properly close karo
process.on("SIGTERM", async () => {
  console.log("🛑 Server shutting down gracefully...");
  await mongoose.connection.close();
  process.exit(0);
});

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Promise Rejection:", err.message);
  // Server crash nahi karo — bas log karo
});

module.exports = app;