// backend/routes/products.js
const express = require("express");
const router  = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");
const {
  getAllProducts,
  getProductById,
  addProduct,
  updateProduct,
  deleteProduct,
  updateStock,
} = require("../controllers/productController");

// ✅ Public — koi bhi dekh sakta hai
router.get("/",    getAllProducts);
router.get("/:id", getProductById);

// ✅ Admin only — protect + adminOnly dono lagate hain
router.post("/",           protect, adminOnly, addProduct);
router.put("/:id",         protect, adminOnly, updateProduct);
router.delete("/:id",      protect, adminOnly, deleteProduct);
router.patch("/:id/stock", protect, adminOnly, updateStock);

module.exports = router;