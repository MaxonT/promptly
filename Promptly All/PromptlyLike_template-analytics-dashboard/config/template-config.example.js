/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Analytics Dashboard - 主配置文件
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * 这是模板的核心配置文件。使用本模板时，你需要根据自己的产品和业务情况
 * 修改以下配置项。
 * 
 * 使用方法:
 *   1. 复制此文件为 template-config.js
 *   2. 根据你的产品修改配置值
 *   3. 导入并使用: import { CONFIG } from './config/template-config.js';
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// 产品基础信息
// ═══════════════════════════════════════════════════════════════════════════════

export const PRODUCT_CONFIG = {
  // 产品名称 (显示在 dashboard 标题)
  name: "Your Product Name",
  
  // 产品类型 - 影响默认参数和基准值
  // 可选: 'saas-b2b' | 'content-media' | 'social-community' | 'ecommerce' | 'utility-tool'
  industryType: "saas-b2b",
  
  // 产品简介
  description: "Your product description",
  
  // 产品阶段 - 影响目标值建议
  // 可选: 'mvp' | 'growth' | 'mature'
  stage: "growth"
};

// ═══════════════════════════════════════════════════════════════════════════════
// 目标设置
// ═══════════════════════════════════════════════════════════════════════════════

export const GOALS_CONFIG = {
  // 总用户目标
  totalUsers: 5000,
  
  // 日活跃用户目标
  dailyActiveUsers: 500,
  
  // (可选) 月活跃用户目标
  monthlyActiveUsers: null,  // 设为 null 则根据 stickiness 自动计算
  
  // Stickiness 目标 (DAU/MAU 百分比)
  // 行业参考: SaaS 10-20%, 内容 20-35%, 社交 40-60%
  targetStickiness: 15
};

// ═══════════════════════════════════════════════════════════════════════════════
// 活跃用户定义
// ═══════════════════════════════════════════════════════════════════════════════

export const ACTIVE_DEFINITION = {
  // 活跃定义类型
  // 'any_visit'       - 任何访问都算活跃
  // 'page_view'       - 至少浏览 N 个页面
  // 'feature_usage'   - 使用特定功能
  // 'time_spent'      - 停留超过 N 秒
  // 'custom_event'    - 触发自定义事件
  type: "any_visit",
  
  // 最小事件数 (type=page_view 时使用)
  minimumEvents: 1,
  
  // 最小停留时间秒数 (type=time_spent 时使用)
  minimumDuration: 0,
  
  // 活跃事件列表 (type=feature_usage 或 custom_event 时使用)
  activeEvents: [
    "page_view",
    "feature_use",
    "form_submit"
  ]
};

// ═══════════════════════════════════════════════════════════════════════════════
// S-曲线增长模型配置
// ═══════════════════════════════════════════════════════════════════════════════

export const GROWTH_CONFIG = {
  // 使用预设场景，或设置为 'custom' 使用自定义参数
  // 预设: 'rapid' | 'steady' | 'slow' | 'viral' | 'custom'
  scenario: "steady",
  
  // 自定义参数 (仅当 scenario='custom' 时使用)
  custom: {
    targetUsers: 2000,      // L: 最终用户数 (渐近线)
    growthRate: 0.08,       // k: 增长率 (0.05-0.18)
    inflectionDays: 45,     // x0: 拐点天数 (增长最快的时间点)
    dailyChurn: 0.015       // 日流失率
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 显示配置
// ═══════════════════════════════════════════════════════════════════════════════

export const DISPLAY_CONFIG = {
  // 显示的指标卡片 (按顺序)
  visibleMetrics: [
    "dau",            // 日活跃用户
    "wau",            // 周活跃用户
    "mau",            // 月活跃用户
    "stickiness",     // 粘性 (DAU/MAU)
    "bounce_rate",    // 跳出率
    "new_users"       // 新用户
    // 可添加自定义指标...
  ],
  
  // 隐藏的默认指标 (如果要隐藏某些指标)
  hiddenMetrics: [
    // "return_frequency"  // 回访频率
  ],
  
  // 数字格式
  numberFormat: {
    // 是否使用简化显示 (1.4K 而不是 1,400)
    useShortFormat: false,  // v2.0 默认使用精确数字
    
    // 百分比小数位数
    percentDecimals: 2,
    
    // 普通数字小数位数
    numberDecimals: 0
  },
  
  // 图表配置
  charts: {
    // Growth Velocity 图表的时间粒度选项
    growthVelocityOptions: ["1h", "6h", "12h", "30d"],
    defaultGrowthVelocity: "30d",
    
    // Cumulative Users 图表的时间范围选项
    cumulativeOptions: ["7d", "14d", "30d", "all"],
    defaultCumulative: "14d"
  },
  
  // 自动刷新间隔 (毫秒)
  refreshInterval: 30000  // 30秒
};

// ═══════════════════════════════════════════════════════════════════════════════
// API 配置
// ═══════════════════════════════════════════════════════════════════════════════

export const API_CONFIG = {
  // API 基础 URL
  // 开发环境通常是 http://localhost:8080
  // 生产环境需要替换为你的后端 URL
  baseUrl: process.env.API_BASE || "http://localhost:8080",
  
  // API 路径前缀
  prefix: "/api/analytics/dashboard",
  
  // 请求超时 (毫秒)
  timeout: 10000,
  
  // 重试次数
  retryCount: 3
};

// ═══════════════════════════════════════════════════════════════════════════════
// 行为追踪配置
// ═══════════════════════════════════════════════════════════════════════════════

export const TRACKING_CONFIG = {
  // 是否启用自动追踪
  autoTrack: true,
  
  // 追踪的行为类型
  trackEvents: {
    pageViews: true,
    clicks: true,
    scrolls: true,
    mouseMovements: true,
    typing: true,
    formSubmissions: true
  },
  
  // 行为数据上报间隔 (毫秒)
  reportInterval: 30000,  // 30秒
  
  // 会话超时时间 (毫秒)
  sessionTimeout: 1800000  // 30分钟
};

// ═══════════════════════════════════════════════════════════════════════════════
// 主题配置
// ═══════════════════════════════════════════════════════════════════════════════

export const THEME_CONFIG = {
  // 主题模式: 'dark' | 'light' | 'neon'
  mode: "dark",
  
  // 自定义颜色 (可选，覆盖默认主题)
  colors: {
    // primary: "#667eea",
    // secondary: "#764ba2",
    // accent: "#00d4ff"
  },
  
  // 粒子效果
  particles: {
    enabled: true,
    count: 40
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 导出统一配置对象
// ═══════════════════════════════════════════════════════════════════════════════

export const CONFIG = {
  product: PRODUCT_CONFIG,
  goals: GOALS_CONFIG,
  activeDefinition: ACTIVE_DEFINITION,
  growth: GROWTH_CONFIG,
  display: DISPLAY_CONFIG,
  api: API_CONFIG,
  tracking: TRACKING_CONFIG,
  theme: THEME_CONFIG,
  
  // 便捷访问
  get apiBase() {
    return this.api.baseUrl;
  },
  
  get totalUsersGoal() {
    return this.goals.totalUsers;
  },
  
  get dauGoal() {
    return this.goals.dailyActiveUsers;
  }
};

export default CONFIG;
