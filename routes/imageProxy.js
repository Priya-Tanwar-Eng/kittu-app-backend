// backend/routes/imageProxy.js
// ✅ Flaticon images ko server-side cache karta hai
// Browser ko baar baar Flaticon se fetch nahi karna padta

const express = require("express");
const https   = require("https");
const http    = require("http");
const router  = express.Router();

// ✅ Simple in-memory cache — restart pe clear hoga
// Production mein Redis use kar sakte hain
const cache = new Map();
const CACHE_MAX  = 500;          // max 500 images memory mein
const CACHE_TTL  = 24 * 60 * 60 * 1000; // 24 hours

// GET /api/img?url=https://cdn-icons-png.flaticon.com/128/xxx.png
router.get("/", async (req, res) => {
  const { url } = req.query;

  // ✅ Sirf allowed domains se images fetch karo
  const allowed = [
    "cdn-icons-png.flaticon.com",
    "res.cloudinary.com",
    "images.unsplash.com",
  ];

  if (!url || !allowed.some((d) => url.includes(d))) {
    return res.status(400).json({ error: "Invalid image URL" });
  }

  // ✅ Cache hit — seedha return karo
  const cached = cache.get(url);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    res.set({
      "Content-Type":  cached.contentType,
      "Cache-Control": "public, max-age=86400, immutable",
      "X-Cache":       "HIT",
    });
    return res.send(cached.data);
  }

  // ✅ Fetch from origin
  try {
    const imageData = await fetchImage(url);

    // Cache mein save karo (LRU — oldest delete karo agar full ho)
    if (cache.size >= CACHE_MAX) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    cache.set(url, { data: imageData.buffer, contentType: imageData.contentType, time: Date.now() });

    res.set({
      "Content-Type":  imageData.contentType,
      "Cache-Control": "public, max-age=86400, immutable",
      "X-Cache":       "MISS",
    });
    res.send(imageData.buffer);

  } catch (err) {
    console.error("Image proxy error:", err.message);
    res.status(502).json({ error: "Image fetch failed" });
  }
});

// Helper — image fetch karo
function fetchImage(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    protocol.get(url, { timeout: 5000 }, (response) => {
      // Redirect handle karo
      if (response.statusCode === 301 || response.statusCode === 302) {
        return fetchImage(response.headers.location).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`Status ${response.statusCode}`));
      }
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        buffer: Buffer.concat(chunks),
        contentType: response.headers["content-type"] || "image/png",
      }));
    }).on("error", reject).on("timeout", () => reject(new Error("Timeout")));
  });
}

module.exports = router;