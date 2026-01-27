// ============================================
// Promptly Frontend - API Configuration
// ============================================
// 
// ⚠️  TEMPORARY FILE - Will be auto-generated in production
// This file is for local development only
// 
// For production deployment:
// 1. Set Vercel environment variable: VITE_API_BASE
// 2. Vercel will run: npm run build (auto-generates this file)
// 
// For local development:
// 1. Run: VITE_API_BASE=http://localhost:8080 npm run build
// 2. Or manually edit this file with your backend URL
// ============================================

// 临时配置 - 指向 Render 后端
// 这个 URL 会在 Vercel 部署时自动替换为环境变量的值
window.PROMPTLY_API_BASE = "https://promptly-v0-6-cloudtest-cursor-dev.onrender.com";

// 维护模式开关
// 设置为 true 时，所有访问都会重定向到维护页面
// 部署时可以通过修改这个值来启用/禁用维护模式
window.PROMPTLY_MAINTENANCE_MODE = true;

console.log("[Promptly] API Base configured:", window.PROMPTLY_API_BASE);
console.log("[Promptly] Maintenance Mode:", window.PROMPTLY_MAINTENANCE_MODE ? "🔧 ENABLED" : "✅ Disabled");
console.log("[Promptly] ⚠️  Using manual config (not auto-generated)");

