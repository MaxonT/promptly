/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Analytics Dashboard - JavaScript Template v1.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * 功能特性:
 * - 实时数据从后端 API 获取
 * - 交互式图表 (Chart.js)
 * - 自动刷新 (默认30秒)
 * - 动态粒子背景效果
 * - 响应式设计支持
 * 
 * 使用方法:
 * 1. 在 config.js 中配置 ANALYTICS_CONFIG
 * 2. 确保后端 API 已启动
 * 3. 引入此脚本到 HTML
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration - 配置读取
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 从全局配置获取 API 基础地址
 * 优先级: ANALYTICS_CONFIG.API_BASE > window.API_BASE > 默认空字符串
 */
const API_BASE = (() => {
  // 检查全局配置
  if (typeof ANALYTICS_CONFIG !== 'undefined' && ANALYTICS_CONFIG.API_BASE) {
    return ANALYTICS_CONFIG.API_BASE.trim().replace(/\/$/, '');
  }
  // 检查窗口级别配置
  if (window.API_BASE && window.API_BASE.trim()) {
    return window.API_BASE.trim().replace(/\/$/, '');
  }
  // 默认本地开发地址
  return 'http://localhost:8080';
})();

/**
 * Dashboard 配置
 * 可在 config.js 中覆盖这些默认值
 */
const CONFIG = {
  // 自动刷新间隔 (毫秒) - 默认30秒
  refreshInterval: (typeof ANALYTICS_CONFIG !== 'undefined' && ANALYTICS_CONFIG.AUTO_REFRESH_INTERVAL) 
    ? ANALYTICS_CONFIG.AUTO_REFRESH_INTERVAL 
    : 30000,
  
  // 目标值 (用于进度条显示)
  goals: (typeof ANALYTICS_CONFIG !== 'undefined' && ANALYTICS_CONFIG.GOALS)
    ? ANALYTICS_CONFIG.GOALS
    : {
        totalUsers: 5000,      // 总用户目标
        dailyActiveUsers: 500  // DAU目标
      },
  
  // 粒子数量
  particleCount: (typeof ANALYTICS_CONFIG !== 'undefined' && ANALYTICS_CONFIG.PARTICLE_CONFIG?.count)
    ? ANALYTICS_CONFIG.PARTICLE_CONFIG.count
    : 40,
  
  // 图表颜色
  chartColors: (typeof ANALYTICS_CONFIG !== 'undefined' && ANALYTICS_CONFIG.CHART_COLORS)
    ? ANALYTICS_CONFIG.CHART_COLORS
    : {
        primary: '#3b82f6',    // 蓝色
        secondary: '#8b5cf6',  // 紫色
        success: '#22c55e',    // 绿色
        warning: '#f59e0b',    // 黄色
        danger: '#ef4444'      // 红色
      },
  
  // API 基础地址
  apiBase: API_BASE
};

// ═══════════════════════════════════════════════════════════════════════════════
// State - 应用状态管理
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 全局状态对象
 */
let state = {
  summary: null,           // API 返回的摘要数据
  timeseries: [],          // 时间序列数据
  loading: true,           // 加载状态
  autoRefresh: true,       // 是否自动刷新
  timeRange: '14d',        // 当前选择的时间范围
  cumulativeRange: '14d',  // 累计图表的时间范围
  charts: {
    growth: null,          // 增长图表实例
    cumulative: null       // 累计用户图表实例
  },
  error: null              // 错误状态
};

// ═══════════════════════════════════════════════════════════════════════════════
// API Functions - API 调用函数
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 获取仪表盘摘要数据
 * @returns {Promise<Object|null>} 摘要数据或 null
 */
async function fetchSummary() {
  try {
    const res = await fetch(`${CONFIG.apiBase}/api/analytics/dashboard/summary`);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();
    
    if (data.ok) {
      state.summary = data;
      // 如果服务器返回了目标值，更新配置
      if (data.goals) {
        CONFIG.goals = data.goals;
      }
      state.error = null;
    }
    
    return data;
  } catch (err) {
    console.error('[analytics] Fetch summary error:', err);
    state.error = `Failed to fetch data: ${err.message}`;
    showError(state.error);
    return null;
  }
}

/**
 * 获取时间序列数据
 * @returns {Promise<Object|null>} 时间序列数据或 null
 */
async function fetchTimeseries() {
  try {
    // 计算需要获取的天数 (取 timeRange 和 cumulativeRange 的较大值)
    const getDays = (range) => {
      switch (range) {
        case '7d': return 7;
        case '14d': return 14;
        case '30d': return 30;
        case 'all': return 365;
        default: return 14;
      }
    };
    
    const days = Math.max(getDays(state.timeRange), getDays(state.cumulativeRange));
    const res = await fetch(`${CONFIG.apiBase}/api/analytics/dashboard/timeseries?days=${days}`);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();
    
    if (data.ok) {
      state.timeseries = data.data || [];
      state.error = null;
    }
    
    return data;
  } catch (err) {
    console.error('[analytics] Fetch timeseries error:', err);
    state.error = `Failed to fetch timeseries: ${err.message}`;
    return null;
  }
}

/**
 * 刷新所有数据
 */
async function refreshData() {
  state.loading = true;
  updateLoadingState(true);
  
  // 并行获取摘要和时间序列数据
  await Promise.all([fetchSummary(), fetchTimeseries()]);
  
  state.loading = false;
  updateLoadingState(false);
  
  // 渲染仪表盘
  renderDashboard();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Render Functions - 渲染函数
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 渲染整个仪表盘
 */
function renderDashboard() {
  if (!state.summary) {
    console.warn('[analytics] No summary data to render');
    return;
  }
  
  const s = state.summary;
  
  // 1. 更新目标进度卡片
  updateGoalProgress('user', s.users?.total || 0, CONFIG.goals.totalUsers);
  updateGoalProgress('dau', s.activity?.dau || 0, CONFIG.goals.dailyActiveUsers);
  
  // 2. 更新核心指标卡片
  safeUpdateText('metricDAU', formatNumber(s.activity?.dau || 0));
  safeUpdateText('metricWAU', formatNumber(s.activity?.wau || 0));
  safeUpdateText('metricMAU', formatNumber(s.activity?.mau || 0));
  safeUpdateText('metricStickiness', `${s.activity?.dau_mau_ratio || 0}%`);
  safeUpdateText('metricBounce', `${s.behavior?.bounceRate || 0}%`);
  safeUpdateText('metricNew', formatNumber(s.users?.newLast24h || 0));
  
  // 3. 更新用户参与度统计
  safeUpdateText('engageMouse', s.engagement?.avgMouseMovements || '0');
  safeUpdateText('engageScroll', s.engagement?.avgScrolls || '0');
  safeUpdateText('engageClicks', s.engagement?.avgClicks || '0');
  safeUpdateText('engageTyping', s.engagement?.avgTypingEvents || '0');
  
  // 4. 更新地区分布
  renderRegions(s.timezones || []);
  
  // 5. 更新图表
  renderCharts();
  
  // 6. 更新时间戳
  safeUpdateText('lastUpdated', `Updated: ${new Date().toLocaleTimeString()}`);
}

/**
 * 安全更新文本内容
 * @param {string} elementId - 元素ID
 * @param {string} text - 要设置的文本
 */
function safeUpdateText(elementId, text) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = text;
  }
}

/**
 * 更新目标进度卡片
 * @param {string} type - 'user' 或 'dau'
 * @param {number} current - 当前值
 * @param {number} target - 目标值
 */
function updateGoalProgress(type, current, target) {
  const progress = Math.min(100, (current / target) * 100);
  
  if (type === 'user') {
    safeUpdateText('totalUsers', formatNumber(current));
    safeUpdateText('userProgress', `${progress.toFixed(1)}%`);
    const barFill = document.getElementById('userBarFill');
    if (barFill) barFill.style.width = `${progress}%`;
    safeUpdateText('userGoalBadge', `Goal: ${formatNumber(target)}`);
  } else if (type === 'dau') {
    safeUpdateText('currentDAU', formatNumber(current));
    safeUpdateText('dauProgress', `${progress.toFixed(1)}%`);
    const barFill = document.getElementById('dauBarFill');
    if (barFill) barFill.style.width = `${progress}%`;
    safeUpdateText('dauGoalBadge', `Goal: ${formatNumber(target)}`);
  }
}

/**
 * 渲染地区分布
 * @param {Array} timezones - 时区数据数组
 */
function renderRegions(timezones) {
  const container = document.getElementById('regionsGrid');
  if (!container) return;
  
  // 排序并取前12个
  const sorted = [...timezones]
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
  
  if (sorted.length === 0) {
    container.innerHTML = '<p style="color: var(--muted); text-align: center; grid-column: 1/-1;">No geographic data available</p>';
    return;
  }
  
  container.innerHTML = sorted.map(tz => {
    // 从时区字符串提取城市名
    const name = tz.timezone.split('/').pop()?.replace(/_/g, ' ') || tz.timezone;
    return `
      <div class="region-item">
        <p class="region-name">${escapeHtml(name)}</p>
        <p class="region-count">${formatNumber(tz.count)}</p>
        <p class="region-events">${tz.uniqueEvents || 0} events</p>
      </div>
    `;
  }).join('');
}

/**
 * 渲染图表
 */
function renderCharts() {
  if (!state.timeseries.length) {
    console.warn('[analytics] No timeseries data for charts');
    return;
  }
  
  renderGrowthChart();
  renderCumulativeChart();
}

/**
 * 渲染增长趋势图
 */
function renderGrowthChart() {
  const ctx = document.getElementById('growthChart')?.getContext('2d');
  if (!ctx) return;
  
  // 销毁旧图表
  if (state.charts.growth) {
    state.charts.growth.destroy();
  }
  
  // 根据 timeRange 筛选数据
  const days = state.timeRange === '7d' ? 7 : state.timeRange === '14d' ? 14 : state.timeRange === '30d' ? 30 : 365;
  const data = state.timeseries.slice(-days);
  
  state.charts.growth = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.label),
      datasets: [
        {
          label: 'Active Users',
          data: data.map(d => d.users),
          borderColor: CONFIG.chartColors.primary,
          backgroundColor: `${CONFIG.chartColors.primary}1A`, // 10% opacity
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6
        },
        {
          label: 'Sessions',
          data: data.map(d => d.sessions),
          borderColor: CONFIG.chartColors.success,
          backgroundColor: `${CONFIG.chartColors.success}0D`, // 5% opacity
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          padding: 12,
          cornerRadius: 8,
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 13 }
        }
      },
      scales: {
        x: {
          display: true,
          grid: { display: false },
          ticks: { color: '#64748b', font: { size: 11 } }
        },
        y: {
          display: true,
          grid: { color: 'rgba(100, 116, 139, 0.1)' },
          ticks: { color: '#64748b', font: { size: 11 } }
        }
      }
    }
  });
}

/**
 * 渲染累计用户图
 */
function renderCumulativeChart() {
  const ctx = document.getElementById('cumulativeChart')?.getContext('2d');
  if (!ctx) return;
  
  // 销毁旧图表
  if (state.charts.cumulative) {
    state.charts.cumulative.destroy();
  }
  
  // 根据 cumulativeRange 筛选数据
  const days = state.cumulativeRange === '7d' ? 7 : state.cumulativeRange === '14d' ? 14 : state.cumulativeRange === '30d' ? 30 : 365;
  const data = state.timeseries.slice(-days);
  
  state.charts.cumulative = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        label: 'Total Users',
        data: data.map(d => d.cumulativeUsers),
        borderColor: CONFIG.chartColors.secondary,
        backgroundColor: `${CONFIG.chartColors.secondary}26`, // 15% opacity
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 6,
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => `Total Users: ${formatNumber(ctx.raw)}`
          }
        }
      },
      scales: {
        x: {
          display: true,
          grid: { display: false },
          ticks: { color: '#64748b', font: { size: 11 } }
        },
        y: {
          display: true,
          grid: { color: 'rgba(100, 116, 139, 0.1)' },
          ticks: { color: '#64748b', font: { size: 11 } }
        }
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Utility Functions - 工具函数
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 格式化数字 (添加 K/M 后缀)
 * @param {number} num - 要格式化的数字
 * @returns {string} 格式化后的字符串
 */
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

/**
 * HTML 转义 (防止 XSS)
 * @param {string} str - 要转义的字符串
 * @returns {string} 转义后的字符串
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * 更新加载状态
 * @param {boolean} loading - 是否正在加载
 */
function updateLoadingState(loading) {
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.disabled = loading;
    refreshBtn.classList.toggle('loading', loading);
  }
}

/**
 * 显示错误信息
 * @param {string} message - 错误消息
 */
function showError(message) {
  console.error('[analytics]', message);
  // 可以在这里添加 toast 通知或其他 UI 反馈
}

// ═══════════════════════════════════════════════════════════════════════════════
// Particle Background - 粒子背景系统
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 初始化粒子背景
 */
function initParticles() {
  const container = document.getElementById('particles-container');
  if (!container) return;
  
  // 清空现有粒子
  container.innerHTML = '';
  
  // 获取粒子配置
  const particleConfig = (typeof ANALYTICS_CONFIG !== 'undefined' && ANALYTICS_CONFIG.PARTICLE_CONFIG)
    ? ANALYTICS_CONFIG.PARTICLE_CONFIG
    : { count: 40, minSize: 2, maxSize: 6, opacity: 0.15 };
  
  for (let i = 0; i < particleConfig.count; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    
    const size = particleConfig.minSize + Math.random() * (particleConfig.maxSize - particleConfig.minSize);
    
    particle.style.cssText = `
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      width: ${size}px;
      height: ${size}px;
      opacity: ${Math.random() * particleConfig.opacity + 0.05};
      animation-delay: ${Math.random() * 10}s;
      animation-duration: ${20 + Math.random() * 10}s;
    `;
    
    container.appendChild(particle);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Event Handlers - 事件处理
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 设置事件处理器
 */
function setupEventHandlers() {
  // 刷新按钮
  document.getElementById('refreshBtn')?.addEventListener('click', () => {
    refreshData();
  });
  
  // 时间范围选择器
  document.getElementById('timeRange')?.addEventListener('change', (e) => {
    state.timeRange = e.target.value;
    refreshData();
  });
  
  // 累计图表时间范围选择器
  document.getElementById('cumulativeRange')?.addEventListener('change', (e) => {
    state.cumulativeRange = e.target.value;
    // 仅重新渲染累计图表，无需重新获取数据
    renderCumulativeChart();
  });
  
  // 术语表切换
  document.getElementById('glossaryToggle')?.addEventListener('click', () => {
    const glossary = document.getElementById('glossarySection');
    glossary?.classList.toggle('visible');
    
    if (glossary?.classList.contains('visible')) {
      glossary.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  
  // 术语表关闭
  document.getElementById('glossaryClose')?.addEventListener('click', () => {
    document.getElementById('glossarySection')?.classList.remove('visible');
  });
  
  // 键盘快捷键
  document.addEventListener('keydown', (e) => {
    // ESC 关闭术语表
    if (e.key === 'Escape') {
      document.getElementById('glossarySection')?.classList.remove('visible');
    }
    // R 键刷新 (需要没有在输入框中)
    if (e.key === 'r' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      refreshData();
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Initialization - 初始化
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 初始化仪表盘
 */
async function init() {
  console.log('[analytics-dashboard] Initializing...');
  console.log('[analytics-dashboard] API Base:', CONFIG.apiBase);
  
  // 1. 初始化粒子背景
  initParticles();
  
  // 2. 设置事件处理器
  setupEventHandlers();
  
  // 3. 初始加载数据
  await refreshData();
  
  // 4. 设置自动刷新
  if (state.autoRefresh && CONFIG.refreshInterval > 0) {
    setInterval(() => {
      // 仅在页面可见时刷新
      if (!document.hidden) {
        refreshData();
      }
    }, CONFIG.refreshInterval);
  }
  
  console.log('[analytics-dashboard] Initialized successfully');
}

// DOM 加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Exports - 导出 (供外部调用)
// ═══════════════════════════════════════════════════════════════════════════════

// 暴露到全局，方便调试和外部调用
window.AnalyticsDashboard = {
  refresh: refreshData,
  getState: () => state,
  getConfig: () => CONFIG
};
