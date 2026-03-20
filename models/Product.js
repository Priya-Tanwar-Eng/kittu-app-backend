// backend/models/Product.js
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    image:    { type: String, required: true },
    price:    { type: Number, required: true },
    oldPrice: { type: Number, required: true },
    discount: { type: String },
    rating:   { type: Number, default: 4.0, min: 0, max: 5 },
    reviews:  { type: String, default: "0" },
    category: {
      type: String,
      required: true,
      enum: [
        "fruits-vegetables", "dairy-bread-eggs", "atta-rice-dals",
        "meat-fish", "masala-dry-fruits", "breakfast-sauces",
        "packaged-food", "tea-coffee", "ice-cream-desserts",
        "frozen-food", "beauty", "home", "electronics",
        "toys", "fashion", "other",
      ],
    },
    packSize: { type: String, default: "1 pack" },
    tag:      { type: String, default: "Fresh" },

    // ✅ Stock - no middleware, controller me handle hoga
    stock:   { type: Number, default: 100, min: 0 },
    inStock: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ✅ Database Indexes — category filter aur search fast hoga
// 1000 users ek saath filter kare toh bhi instant response
productSchema.index({ category: 1, createdAt: -1 }); // category page fast
productSchema.index({ name: "text" });                // text search fast
productSchema.index({ inStock: 1, category: 1 });     // in-stock filter fast

module.exports = mongoose.model("Product", productSchema);