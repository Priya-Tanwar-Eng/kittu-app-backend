// backend/ecosystem.config.js
// PM2 se start karo: pm2 start ecosystem.config.js
// Install: npm install -g pm2

module.exports = {
  apps: [{
    name: "kittu-backend",
    script: "server.js",

    // ✅ Cluster mode — CPU cores ke hisaab se processes
    // 4 core CPU = 4 processes = 4x throughput
    instances: "max",   // ya specific number: 2, 4
    exec_mode: "cluster",

    // ✅ Auto restart on crash
    autorestart: true,
    watch: false,        // production mein false rakho

    // ✅ Memory limit — 500MB se zyada use kare toh restart
    max_memory_restart: "500M",

    // ✅ Environment variables
    env: {
      NODE_ENV: "development",
      PORT: 5000,
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 5000,
    },

    // ✅ Logs
    error_file: "./logs/error.log",
    out_file:   "./logs/out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
  }],
};