// backend/routes/orders.js
const express  = require("express");
const router   = express.Router();
const { placeOrder, getMyOrders, getOrderById } = require("../controllers/orderController");
const { protect } = require("../middleware/authMiddleware");

// ✅ protect middleware — token verify karega, req.user set karega
router.post("/place",    protect, placeOrder);   // login zaroori
router.get("/my-orders", protect, getMyOrders);  // sirf apne orders

router.get("/:id", getOrderById); // tracking public rehne do

module.exports = router;