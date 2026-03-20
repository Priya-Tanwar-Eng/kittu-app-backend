// seed.js - Ek baar run karo, sab products DB me chale jaenge
// Command: node seed.js

require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("./models/Product");

const products = [
  {
    name: "Fresh Fruits & Vegetables Pack",
    image: "https://cdn-icons-png.flaticon.com/512/2153/2153788.png",
    price: 149,
    oldPrice: 199,
    discount: "₹50",
    rating: 4.5,
    reviews: "8.2k",
    category: "fruits-vegetables",
    packSize: "1 pack (500g)",
    tag: "Fresh & Healthy",
  },
  {
    name: "Dairy, Bread & Eggs Combo",
    image: "https://cdn-icons-png.flaticon.com/512/3050/3050158.png",
    price: 199,
    oldPrice: 249,
    discount: "₹50",
    rating: 4.6,
    reviews: "6.5k",
    category: "dairy-bread-eggs",
    packSize: "1 combo pack",
    tag: "Daily Essential",
  },
  {
    name: "Premium Atta, Rice & Dals",
    image: "https://cdn-icons-png.flaticon.com/512/1046/1046784.png",
    price: 299,
    oldPrice: 349,
    discount: "₹50",
    rating: 4.7,
    reviews: "10.1k",
    category: "atta-rice-dals",
    packSize: "1 pack (5 kg)",
    tag: "Best Seller",
  },
  {
    name: "Fresh Meat, Fish & Eggs",
    image: "https://cdn-icons-png.flaticon.com/512/3075/3075977.png",
    price: 399,
    oldPrice: 459,
    discount: "₹60",
    rating: 4.4,
    reviews: "4.8k",
    category: "meat-fish",
    packSize: "1 pack (500g)",
    tag: "Farm Fresh",
  },
  {
    name: "Masala & Dry Fruits Pack",
    image: "https://cdn-icons-png.flaticon.com/512/1046/1046786.png",
    price: 249,
    oldPrice: 299,
    discount: "₹50",
    rating: 4.8,
    reviews: "9.3k",
    category: "masala-dry-fruits",
    packSize: "1 pack (200g)",
    tag: "Premium Quality",
  },
  {
    name: "Breakfast & Sauces Essentials",
    image: "https://cdn-icons-png.flaticon.com/512/5787/5787016.png",
    price: 179,
    oldPrice: 229,
    discount: "₹50",
    rating: 4.5,
    reviews: "5.9k",
    category: "breakfast-sauces",
    packSize: "1 combo",
    tag: "Morning Fresh",
  },
  {
    name: "Packaged Food Combo",
    image: "https://cdn-icons-png.flaticon.com/512/1046/1046857.png",
    price: 159,
    oldPrice: 199,
    discount: "₹40",
    rating: 4.3,
    reviews: "7.4k",
    category: "packaged-food",
    packSize: "1 pack",
    tag: "Ready to Eat",
  },
  {
    name: "Tea, Coffee & More Collection",
    image: "https://cdn-icons-png.flaticon.com/512/924/924514.png",
    price: 129,
    oldPrice: 169,
    discount: "₹40",
    rating: 4.6,
    reviews: "6.1k",
    category: "tea-coffee",
    packSize: "1 pack (250g)",
    tag: "Fresh & Fragrant",
  },
  {
    name: "Ice Creams & Desserts",
    image: "https://cdn-icons-png.flaticon.com/512/1046/1046873.png",
    price: 99,
    oldPrice: 129,
    discount: "₹30",
    rating: 4.7,
    reviews: "11.2k",
    category: "ice-cream-desserts",
    packSize: "1 pack (500ml)",
    tag: "Chilled & Yummy",
  },
  {
    name: "Frozen Food Specials",
    image: "https://cdn-icons-png.flaticon.com/512/2933/2933828.png",
    price: 189,
    oldPrice: 239,
    discount: "₹50",
    rating: 4.4,
    reviews: "3.9k",
    category: "frozen-food",
    packSize: "1 pack (400g)",
    tag: "Quick & Easy",
  },
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/zapto-db");
    console.log("✅ MongoDB connected");

    // Pehle sab delete karo (fresh start)
    await Product.deleteMany({});
    console.log("🗑️  Old products cleared");

    // Naye products insert karo
    const inserted = await Product.insertMany(products);
    console.log(`✅ ${inserted.length} products inserted successfully!`);

    mongoose.connection.close();
    console.log("✅ Done! Database close kiya.");

  } catch (err) {
    console.error("❌ Seed failed:", err.message);
    process.exit(1);
  }
};

seedDB();