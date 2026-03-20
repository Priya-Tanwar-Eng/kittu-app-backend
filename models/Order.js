// backend/models/Order.js
const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ZaptoUser",
    required: false,
  },
  customerInfo: {
    name:  { type: String, required: true },
    phone: { type: String, required: true },
  },
  address: {
    houseNo:  String,
    street:   String,
    landmark: String,
    city:     String,
    pincode:  String,
  },
  items: [{
    _id:      String,
    name:     String,
    image:    String,
    price:    Number,
    quantity: Number,
    packSize: String,
  }],
  subtotal:       { type: Number, required: true },
  deliveryCharge: { type: Number, default: 0 },
  totalAmount:    { type: Number, required: true },
  paymentMethod:  { type: String, enum: ["cod", "upi"], default: "cod" },
  status: {
    type: String,
    enum: ["confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"],
    default: "confirmed",
  },
  placedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// ✅ Database Indexes — queries 10x faster ho jaayengi
// "My Orders" page ke liye — userId se orders dhundhna fast hoga
orderSchema.index({ userId: 1, createdAt: -1 });
// Admin panel ke liye — status filter fast hoga
orderSchema.index({ status: 1, createdAt: -1 });
// Order tracking ke liye — _id already indexed hai by default

module.exports = mongoose.model("Order", orderSchema);