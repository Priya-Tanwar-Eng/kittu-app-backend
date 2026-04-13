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

// ─── 1. CORS ──────────────────────────────────────────────────
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map(o => o.trim())
  : ["http://localhost:5173", "http://localhost:4173", "http://127.0.0.1:5173"];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // ✅ Sab *.vercel.app URLs allow karo
    if (origin.endsWith(".vercel.app")) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));

// ─── 2. Compression ───────────────────────────────────────────
app.use(compression({ level: 6, threshold: 1024 }));

// ─── 3. Rate Limiting ─────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { success: false, message: "Bahut zyada requests! Thoda wait karo." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "GET" && req.path.startsWith("/api/products"),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Bahut zyada login attempts! 15 min baad try karo." },
  skipSuccessfulRequests: true,
});

app.use("/api/", limiter);
app.use("/api/auth/send-otp",   authLimiter);
app.use("/api/auth/verify-otp", authLimiter);

// ─── 4. Body Parsers ──────────────────────────────────────────
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
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err.message);
  res.status(500).json({ success: false, message: "Server error. Please try again." });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─── 9. MongoDB Connection ────────────────────────────────────
const PORT        = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/kittu-db";

mongoose.connect(MONGODB_URI, {
  maxPoolSize: 20,
  minPoolSize: 5,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000,
  heartbeatFrequencyMS: 10000,
})
.then(() => {
  console.log("✅ MongoDB connected! Pool size: 20");
  app.listen(PORT, () => {
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`📦 Environment: ${process.env.NODE_ENV || "development"}`);
  });

  // ✅ Self-ping — Render free tier sleep nahi karega
  if (process.env.NODE_ENV === "production" && process.env.RENDER_URL) {
    setInterval(async () => {
      try {
        await fetch(`${process.env.RENDER_URL}/`);
        console.log("🏓 Self-ping done");
      } catch (e) {
        console.log("Self-ping failed:", e.message);
      }
    }, 14 * 60 * 1000);
  }
})
.catch((err) => {
  console.error("❌ MongoDB error:", err.message);
  process.exit(1);
});

// ✅ Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("🛑 Server shutting down gracefully...");
  await mongoose.connection.close();
  process.exit(0);
});

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Promise Rejection:", err.message);
});

module.exports = app;