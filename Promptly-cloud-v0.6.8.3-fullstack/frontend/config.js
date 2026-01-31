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

// 根据运行环境自动设置API基础URL
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const isRender = window.location.hostname.includes('.onrender.com');

if (isRender && isProduction) {
  // Render 生产环境：前端在promptly-v0-6-cloudtest-1.onrender.com，后端在promptly-v0-6-cloudtest-cursor-dev.onrender.com
  window.PROMPTLY_API_BASE = "https://promptly-v0-6-cloudtest-cursor-dev.onrender.com";
} else if (isProduction) {
  // 其他生产环境：尝试使用同源（可能是Vercel或其他平台）
  window.PROMPTLY_API_BASE = `${window.location.protocol}//${window.location.hostname}:${window.location.port || (window.location.protocol === 'https:' ? 443 : 80)}`;
} else {
  // 本地开发环境：使用localhost
  window.PROMPTLY_API_BASE = "http://localhost:8080";
}

// 维护模式开关
// 设置为 true 时，所有访问都会重定向到维护页面
// 部署时可以通过修改这个值来启用/禁用维护模式
window.PROMPTLY_MAINTENANCE_MODE = false;

console.log("[Promptly] Hostname:", window.location.hostname);
console.log("[Promptly] Is Production:", isProduction);
console.log("[Promptly] Is Render:", isRender);
console.log("[Promptly] API Base configured:", window.PROMPTLY_API_BASE);
console.log("[Promptly] Maintenance Mode:", window.PROMPTLY_MAINTENANCE_MODE ? "🔧 ENABLED" : "✅ Disabled");
console.log("[Promptly] ⚠️  Using auto-detected config");

