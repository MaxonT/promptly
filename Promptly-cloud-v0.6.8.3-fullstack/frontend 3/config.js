// API Configuration
// Set the backend API URL here when deploying to production
// 
// For local development: leave as null (will use localhost:8080)
// For production: set to your backend URL (e.g., https://your-backend.onrender.com)
//
// You can also set this via environment variable injection during build time

// 生产环境配置 - 指向 Render 后端
window.PROMPTLY_API_BASE = "https://promptly-v0-6-cloudtest.onrender.com";

console.log("[Promptly] API Base configured:", window.PROMPTLY_API_BASE || "auto-detect");

