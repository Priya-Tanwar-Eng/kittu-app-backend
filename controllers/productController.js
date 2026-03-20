// backend/controllers/productController.js
const Product = require("../models/Product");

// ─── In-Memory Cache ──────────────────────────────────────────
// MongoDB se baar baar fetch nahi hoga — server memory mein rakho
const cache = {
  data: new Map(),
  TTL:  2 * 60 * 1000,  // 2 min

  key: (category = "", search = "", sort = "") => `${category}|${search}|${sort}`,

  get(category, search, sort) {
    const entry = this.data.get(this.key(category, search, sort));
    if (!entry) return null;
    if (Date.now() - entry.time > this.TTL) {
      this.data.delete(this.key(category, search, sort));
      return null;
    }
    return entry.products;
  },

  set(category, search, sort, products) {
    if (this.data.size >= 50) {
      this.data.delete(this.data.keys().next().value);
    }
    this.data.set(this.key(category, search, sort), { products, time: Date.now() });
  },

  invalidate() {
    this.data.clear();
    console.log("🗑️  Product cache cleared");
  },
};

// GET /api/products
exports.getAllProducts = async (req, res) => {
  try {
    const { category = "", search = "", sort = "" } = req.query;

    // ✅ Cache hit — MongoDB call nahi hoga (~5ms response!)
    const cached = cache.get(category, search, sort);
    if (cached) {
      res.set("X-Cache", "HIT");
      return res.status(200).json({ success: true, count: cached.length, products: cached });
    }

    // Cache miss — MongoDB se fetch
    let filter = {};
    if (category) filter.category = category;
    if (search)   filter.name = { $regex: search, $options: "i" };

    let sortOption = { createdAt: -1 };
    if (sort === "price-low")  sortOption = { price: 1 };
    if (sort === "price-high") sortOption = { price: -1 };
    if (sort === "rating")     sortOption = { rating: -1 };

    // ✅ .lean() — plain JS objects return karta hai, Mongoose overhead nahi
    const products = await Product.find(filter).sort(sortOption).lean();

    cache.set(category, search, sort, products);

    res.set("X-Cache", "MISS");
    return res.status(200).json({ success: true, count: products.length, products });

  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/products/:id
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    return res.status(200).json({ success: true, product });
  } catch {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/products
exports.addProduct = async (req, res) => {
  try {
    const { name, image, price, oldPrice, discount, rating, reviews, category, packSize, tag, stock } = req.body;
    const stockVal = stock !== undefined ? Number(stock) : 100;
    const product = await Product.create({
      name, image,
      price: Number(price), oldPrice: Number(oldPrice),
      discount: discount || `₹${Number(oldPrice) - Number(price)}`,
      rating: Number(rating) || 4.0, reviews: reviews || "0",
      category, packSize, tag,
      stock: stockVal,
      inStock: stockVal > 0,
    });
    cache.invalidate();
    return res.status(201).json({ success: true, product });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/products/:id
exports.updateProduct = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.stock !== undefined) {
      updateData.stock   = Number(updateData.stock);
      updateData.inStock = updateData.stock > 0;
    }
    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    cache.invalidate();
    return res.status(200).json({ success: true, product });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE /api/products/:id
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    cache.invalidate();
    return res.status(200).json({ success: true, message: "Product deleted" });
  } catch {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// PATCH /api/products/:id/stock
exports.updateStock = async (req, res) => {
  try {
    const stockVal = Math.max(0, Number(req.body.stock));
    const product  = await Product.findByIdAndUpdate(
      req.params.id,
      { stock: stockVal, inStock: stockVal > 0 },
      { new: true }
    );
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    cache.invalidate();
    return res.status(200).json({ success: true, product });
  } catch {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};