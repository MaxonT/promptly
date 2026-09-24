/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Analytics Helper Functions - Template v1.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * 提供 Analytics Dashboard 所需的辅助函数:
 * - S-曲线计算函数
 * - 数据生成工具
 * - 统计计算
 * - 数据验证
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// S-Curve Formula - S曲线公式
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * S-曲线 (Logistic Function) 计算
 * 
 * 公式: f(x) = L / (1 + e^(-k(x - x0)))
 * 
 * @param {number} x - 当前天数 (从项目开始日计)
 * @param {number} L - 最大用户数 (渐近线/目标用户数)
 * @param {number} k - 增长率 (典型值: 0.06-0.15, 越大增长越快)
 * @param {number} x0 - 拐点 (达到50%用户的天数)
 * @returns {number} 累积用户数
 * 
 * @example
 * // 目标2000用户, 增长率0.08, 拐点在第40天
 * sCurve(60, 2000, 0.08, 40) // => ~1461 用户
 */
export function sCurve(x, L, k, x0) {
  return L / (1 + Math.exp(-k * (x - x0)));
}

/**
 * 计算某一天的新增用户数
 * 
 * @param {number} day - 当前天数
 * @param {number} L - 最大用户数
 * @param {number} k - 增长率
 * @param {number} x0 - 拐点
 * @returns {number} 当天新增用户数
 */
export function dailyNewUsers(day, L, k, x0) {
  const today = sCurve(day, L, k, x0);
  const yesterday = day > 0 ? sCurve(day - 1, L, k, x0) : 0;
  return Math.max(0, Math.round(today - yesterday));
}

/**
 * 计算S曲线导数 (增长速度)
 * 
 * @param {number} x - 当前天数
 * @param {number} L - 最大用户数
 * @param {number} k - 增长率
 * @param {number} x0 - 拐点
 * @returns {number} 增长速度
 */
export function sCurveDerivative(x, L, k, x0) {
  const fx = sCurve(x, L, k, x0);
  return k * fx * (1 - fx / L);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Preset Scenarios - 预设场景
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 预定义的增长场景
 */
export const GROWTH_SCENARIOS = {
  // 快速增长型 (病毒式传播/产品 Hunt 等)
  rapid: {
    name: '快速增长型',
    description: '产品获得早期关注后快速增长',
    targetUsers: 5000,
    growthRate: 0.12,
    inflectionPoint: 30
  },
  
  // 稳定增长型 (常规 SaaS 产品)
  steady: {
    name: '稳定增长型',
    description: '持续稳定的有机增长',
    targetUsers: 2000,
    growthRate: 0.08,
    inflectionPoint: 45
  },
  
  // 慢热型 (企业级产品/B2B)
  slow: {
    name: '慢热型',
    description: '早期缓慢，后期加速',
    targetUsers: 1000,
    growthRate: 0.05,
    inflectionPoint: 60
  },
  
  // 病毒式增长 (社交/工具类)
  viral: {
    name: '病毒式增长',
    description: '爆发式增长后趋于平稳',
    targetUsers: 10000,
    growthRate: 0.18,
    inflectionPoint: 20
  },
  
  // 挣扎期产品
  struggling: {
    name: '挣扎期产品',
    description: '增长缓慢，需要调整策略',
    targetUsers: 500,
    growthRate: 0.04,
    inflectionPoint: 90
  }
};

/**
 * 获取预设场景配置
 * 
 * @param {string} scenarioName - 场景名称
 * @returns {Object} 场景配置
 */
export function getScenario(scenarioName) {
  return GROWTH_SCENARIOS[scenarioName] || GROWTH_SCENARIOS.steady;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ID Generation - ID 生成
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 生成唯一ID
 * 
 * @param {string} prefix - ID前缀
 * @returns {string} 唯一ID
 * 
 * @example
 * generateId('user') // => 'user_1699123456789_a1b2c3d4'
 */
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * 生成UUID v4
 * 
 * @returns {string} UUID
 */
export function generateUUID() {
  return crypto.randomUUID();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Random Data Generators - 随机数据生成器
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 时区列表及其权重 (基于用户分布)
 */
export const TIMEZONES = [
  { zone: 'America/New_York', weight: 20 },
  { zone: 'America/Los_Angeles', weight: 15 },
  { zone: 'America/Chicago', weight: 10 },
  { zone: 'Europe/London', weight: 12 },
  { zone: 'Europe/Paris', weight: 8 },
  { zone: 'Europe/Berlin', weight: 6 },
  { zone: 'Asia/Shanghai', weight: 10 },
  { zone: 'Asia/Tokyo', weight: 8 },
  { zone: 'Asia/Singapore', weight: 5 },
  { zone: 'Australia/Sydney', weight: 4 },
  { zone: 'UTC', weight: 2 }
];

/**
 * 设备类型及权重
 */
export const DEVICE_TYPES = [
  { type: 'desktop', weight: 60 },
  { type: 'mobile', weight: 35 },
  { type: 'tablet', weight: 5 }
];

/**
 * 浏览器及权重
 */
export const BROWSERS = [
  { name: 'Chrome', weight: 65 },
  { name: 'Safari', weight: 20 },
  { name: 'Firefox', weight: 10 },
  { name: 'Edge', weight: 5 }
];

/**
 * 来源渠道
 */
export const SOURCES = [
  { source: 'direct', weight: 30 },
  { source: 'google', weight: 25 },
  { source: 'twitter', weight: 15 },
  { source: 'github', weight: 10 },
  { source: 'producthunt', weight: 8 },
  { source: 'hackernews', weight: 7 },
  { source: 'linkedin', weight: 5 }
];

/**
 * 根据权重随机选择
 * 
 * @param {Array} items - 带权重的项目数组 [{value, weight}, ...]
 * @returns {*} 随机选中的值
 */
export function weightedRandom(items) {
  const total = items.reduce((sum, item) => sum + (item.weight || 1), 0);
  let random = Math.random() * total;
  
  for (const item of items) {
    random -= (item.weight || 1);
    if (random <= 0) {
      // 返回第一个非 weight 的属性值
      const key = Object.keys(item).find(k => k !== 'weight');
      return item[key];
    }
  }
  
  const key = Object.keys(items[0]).find(k => k !== 'weight');
  return items[0][key];
}

/**
 * 获取随机时区
 * @returns {string}
 */
export function getRandomTimezone() {
  return weightedRandom(TIMEZONES);
}

/**
 * 获取随机设备类型
 * @returns {string}
 */
export function getRandomDevice() {
  return weightedRandom(DEVICE_TYPES);
}

/**
 * 获取随机浏览器
 * @returns {string}
 */
export function getRandomBrowser() {
  return weightedRandom(BROWSERS);
}

/**
 * 获取随机来源
 * @returns {string}
 */
export function getRandomSource() {
  return weightedRandom(SOURCES);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Statistical Functions - 统计函数
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 计算平均值
 * @param {number[]} arr - 数字数组
 * @returns {number}
 */
export function average(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * 计算中位数
 * @param {number[]} arr - 数字数组
 * @returns {number}
 */
export function median(arr) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * 计算标准差
 * @param {number[]} arr - 数字数组
 * @returns {number}
 */
export function standardDeviation(arr) {
  if (!arr || arr.length === 0) return 0;
  const avg = average(arr);
  const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
  return Math.sqrt(average(squareDiffs));
}

/**
 * 计算百分位数
 * @param {number[]} arr - 数字数组
 * @param {number} percentile - 百分位 (0-100)
 * @returns {number}
 */
export function percentile(arr, percentile) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Engagement Calculations - 参与度计算
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 计算用户参与度分数
 * 
 * @param {Object} behavior - 用户行为数据
 * @returns {number} 0-100 的参与度分数
 */
export function calculateEngagementScore(behavior) {
  const {
    mouseMovements = 0,
    scrolls = 0,
    clicks = 0,
    typingEvents = 0,
    sessionDuration = 0
  } = behavior;
  
  // 各行为权重
  const weights = {
    mouse: 0.15,      // 鼠标移动
    scroll: 0.20,     // 滚动
    click: 0.30,      // 点击
    typing: 0.20,     // 打字
    duration: 0.15    // 会话时长
  };
  
  // 归一化各指标到 0-100
  const normalized = {
    mouse: Math.min(100, mouseMovements / 3),
    scroll: Math.min(100, scrolls * 4),
    click: Math.min(100, clicks * 8),
    typing: Math.min(100, typingEvents * 1.5),
    duration: Math.min(100, sessionDuration / 3)
  };
  
  // 加权计算
  const score = 
    normalized.mouse * weights.mouse +
    normalized.scroll * weights.scroll +
    normalized.click * weights.click +
    normalized.typing * weights.typing +
    normalized.duration * weights.duration;
  
  return Math.round(Math.min(100, Math.max(0, score)));
}

/**
 * 计算跳出率
 * 
 * @param {Object[]} sessions - 会话数组
 * @returns {number} 跳出率百分比 (0-100)
 */
export function calculateBounceRate(sessions) {
  if (!sessions || sessions.length === 0) return 0;
  
  const bouncedSessions = sessions.filter(s => 
    (s.page_views || s.pageViews || 0) <= 1
  ).length;
  
  return (bouncedSessions / sessions.length) * 100;
}

/**
 * 计算用户留存率
 * 
 * @param {number} initialUsers - 初始用户数
 * @param {number} returnedUsers - 返回用户数
 * @returns {number} 留存率百分比
 */
export function calculateRetentionRate(initialUsers, returnedUsers) {
  if (!initialUsers || initialUsers === 0) return 0;
  return Math.min(100, (returnedUsers / initialUsers) * 100);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Date Utilities - 日期工具
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 获取两个日期之间的天数
 * 
 * @param {string|Date} startDate - 开始日期
 * @param {string|Date} endDate - 结束日期
 * @returns {number} 天数
 */
export function daysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 生成日期范围
 * 
 * @param {string|Date} startDate - 开始日期
 * @param {string|Date} endDate - 结束日期
 * @returns {string[]} 日期数组 (YYYY-MM-DD 格式)
 */
export function dateRange(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

/**
 * 格式化日期为 YYYY-MM-DD
 * 
 * @param {Date|string} date - 日期对象或字符串
 * @returns {string}
 */
export function formatDate(date) {
  return new Date(date).toISOString().split('T')[0];
}

/**
 * 获取相对日期
 * 
 * @param {number} daysAgo - N天前
 * @returns {string} YYYY-MM-DD 格式
 */
export function daysAgo(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return formatDate(date);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Validation - 数据验证
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 验证日期格式
 * 
 * @param {string} dateStr - 日期字符串
 * @returns {boolean}
 */
export function isValidDate(dateStr) {
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date);
}

/**
 * 验证 S-曲线参数
 * 
 * @param {Object} params - S曲线参数
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateSCurveParams(params) {
  const errors = [];
  
  if (!params.targetUsers || params.targetUsers < 1) {
    errors.push('targetUsers must be a positive number');
  }
  
  if (!params.growthRate || params.growthRate <= 0 || params.growthRate > 1) {
    errors.push('growthRate must be between 0 and 1');
  }
  
  if (!params.inflectionPoint || params.inflectionPoint < 1) {
    errors.push('inflectionPoint must be a positive number');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Export All
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  // S-Curve
  sCurve,
  dailyNewUsers,
  sCurveDerivative,
  
  // Scenarios
  GROWTH_SCENARIOS,
  getScenario,
  
  // ID Generation
  generateId,
  generateUUID,
  
  // Random Generators
  TIMEZONES,
  DEVICE_TYPES,
  BROWSERS,
  SOURCES,
  weightedRandom,
  getRandomTimezone,
  getRandomDevice,
  getRandomBrowser,
  getRandomSource,
  
  // Statistics
  average,
  median,
  standardDeviation,
  percentile,
  
  // Engagement
  calculateEngagementScore,
  calculateBounceRate,
  calculateRetentionRate,
  
  // Date Utils
  daysBetween,
  dateRange,
  formatDate,
  daysAgo,
  
  // Validation
  isValidDate,
  validateSCurveParams
};
