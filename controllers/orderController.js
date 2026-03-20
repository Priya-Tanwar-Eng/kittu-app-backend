// backend/controllers/orderController.js
const Order   = require("../models/Order");
const Product = require("../models/Product");

// Helper: stock deduct karo
const deductStock = async (items) => {
  for (const item of items) {
    const productId = item.productId || item._id;
    if (!productId) continue;
    const product = await Product.findById(productId);
    if (!product) continue;
    const newStock = Math.max(0, product.stock - item.quantity);
    await Product.findByIdAndUpdate(productId, { stock: newStock, inStock: newStock > 0 });
  }
};

// =============================================
// POST /api/orders/place
// =============================================
exports.placeOrder = async (req, res) => {
  try {
    const { customerInfo, address, items, subtotal, deliveryCharge, totalAmount, paymentMethod } = req.body;

    if (!items || items.length === 0)
      return res.status(400).json({ success: false, message: "Cart khali hai" });

    // Stock check
    for (const item of items) {
      const productId = item.productId || item._id;
      if (!productId) continue;
      const product = await Product.findById(productId);
      if (!product) continue;
      if (product.stock < item.quantity)
        return res.status(400).json({ success: false, message: `${product.name} ka sirf ${product.stock} stock bacha hai!` });
    }

    // ✅ userId — token se milega agar logged in hai
    // authMiddleware se req.user aata hai (agar protect middleware laga ho)
    const userId = req.user?._id || req.user?.id || null;

    const order = await Order.create({
      userId,  // ✅ save karo
      customerInfo,
      address,
      items,
      subtotal,
      deliveryCharge,
      totalAmount,
      paymentMethod: paymentMethod || "cod",
      status: "confirmed",
      placedAt: new Date(),
    });

    await deductStock(items);

    return res.status(201).json({
      success: true,
      message: "Order place ho gaya! 🎉",
      orderId: order._id,
      order,
    });

  } catch (error) {
    console.error("placeOrder error:", error);
    return res.status(500).json({ success: false, message: "Order save nahi hua" });
  }
};

// =============================================
// GET /api/orders/my-orders
// ✅ Sirf logged-in user ke orders
// =============================================
exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId)
      return res.status(401).json({ success: false, message: "Login karo pehle" });

    // ✅ userId se filter — sirf is user ke orders
    const orders = await Order.find({ userId }).sort({ createdAt: -1 }).limit(50);

    return res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error("getMyOrders error:", error);
    return res.status(500).json({ success: false, message: "Orders nahi mile" });
  }
};

// =============================================
// GET /api/orders/:id
// =============================================
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    return res.status(200).json({ success: true, order });
  } catch {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};