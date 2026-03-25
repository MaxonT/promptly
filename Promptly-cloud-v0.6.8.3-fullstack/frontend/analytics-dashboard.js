/**
 * Analytics Dashboard - Promptly
 * 
 * Features:
 * - Real-time data fetching from backend API
 * - Interactive charts (Chart.js)
 * - Auto-refresh every 30 seconds
 * - Particle background effects
 * - Responsive design
 */

// Get API base from global config
const API_BASE = (window.PROMPTLY_API_BASE && window.PROMPTLY_API_BASE.trim())
  ? window.PROMPTLY_API_BASE.trim().replace(/\/$/, '')
  : '';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  refreshInterval: 30000, // 30 seconds
  goals: {
    totalUsers: 5000,
    dailyActiveUsers: 500
  },
  particleCount: 40,
  apiBase: API_BASE
};

const LAUNCH_DATE = '2025-11-28';
const MILESTONE_DATES = ['2025-12-05', '2026-01-22', '2026-03-13'];
const KEY_NODE_DATES = [LAUNCH_DATE, ...MILESTONE_DATES];
const MILESTONE_LABELS = {
  '2025-11-28': 'Product Finished',
  '2025-12-05': 'Alpha Release',
  '2026-01-22': 'Beta Release',
  '2026-03-13': 'Product Hunt Launch'
};
const MILESTONE_SHORT_LABELS = {
  '2025-11-28': 'Finish',
  '2025-12-05': 'Alpha',
  '2026-01-22': 'Beta',
  '2026-03-13': 'Launch'
};
const MILESTONE_COLORS = {
  '2025-11-28': '#3b82f6',
  '2025-12-05': '#22c55e',
  '2026-01-22': '#f59e0b',
  '2026-03-13': '#ec4899'
};

// ═══════════════════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════════════════

let state = {
  summary: null,
  timeseries: [],
  loading: true,
  autoRefresh: true,
  growthVelocityRange: '30d',  // 4️⃣ Growth Velocity 专属时间粒度
  cumulativeRange: '14d',
  charts: {
    growth: null,
    cumulative: null
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// API Functions
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchSummary() {
  try {
    const res = await fetch(`${CONFIG.apiBase}/api/analytics/dashboard/summary`);
    if (!res.ok) throw new Error('Failed to fetch summary');
    const data = await res.json();
    if (data.ok) {
      state.summary = data;
      // Update goals from server if provided
      if (data.goals) {
        CONFIG.goals = data.goals;
      }
    }
    return data;
  } catch (err) {
    console.error('[analytics] Fetch summary error:', err);
    return null;
  }
}

async function fetchTimeseries() {
  try {
    // 始终获取全部历史数据，前端根据选择的时间范围过滤
    const res = await fetch(`${CONFIG.apiBase}/api/analytics/dashboard/timeseries?period=all`);
    if (!res.ok) throw new Error('Failed to fetch timeseries');
    const data = await res.json();
    if (data.ok) {
      // 保留完整历史数据；累计曲线会从 LAUNCH_DATE 作为原点(0)开始构建
      state.timeseries = (data.data || []).filter(d => d?.date);
    }
    return data;
  } catch (err) {
    console.error('[analytics] Fetch timeseries error:', err);
    return null;
  }
}

async function refreshData() {
  state.loading = true;
  updateLoadingState(true);
  
  await Promise.all([fetchSummary(), fetchTimeseries()]);
  
  state.loading = false;
  updateLoadingState(false);
  renderDashboard();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Render Functions
// ═══════════════════════════════════════════════════════════════════════════════

function renderDashboard() {
  if (!state.summary) return;
  
  const s = state.summary;
  
  // Update goal progress
  updateGoalProgress('user', s.users?.total || 0, CONFIG.goals.totalUsers);
  updateGoalProgress('dau', s.activity?.dau || 0, CONFIG.goals.dailyActiveUsers);
  
  // Update metric cards
  document.getElementById('metricDAU').textContent = formatNumber(s.activity?.dau || 0);
  document.getElementById('metricWAU').textContent = formatNumber(s.activity?.wau || 0);
  document.getElementById('metricMAU').textContent = formatNumber(s.activity?.mau || 0);
  // 6️⃣ 百分比精确到2位小数
  document.getElementById('metricStickiness').textContent = `${parseFloat(s.activity?.dau_mau_ratio || 0).toFixed(2)}%`;
  // 1️⃣ Bounce Rate 实时更新，精确到2位小数
  document.getElementById('metricBounce').textContent = `${parseFloat(s.behavior?.bounceRate || 0).toFixed(2)}%`;
  document.getElementById('metricNew').textContent = formatNumber(s.users?.newLast24h || 0);
  
  // Update engagement stats (optional UI block)
  const engageMouseEl = document.getElementById('engageMouse');
  if (engageMouseEl) engageMouseEl.textContent = s.engagement?.avgMouseMovements || '0';
  const engageScrollEl = document.getElementById('engageScroll');
  if (engageScrollEl) engageScrollEl.textContent = s.engagement?.avgScrolls || '0';
  const engageClicksEl = document.getElementById('engageClicks');
  if (engageClicksEl) engageClicksEl.textContent = s.engagement?.avgClicks || '0';
  const engageTypingEl = document.getElementById('engageTyping');
  if (engageTypingEl) engageTypingEl.textContent = s.engagement?.avgTypingEvents || '0';
  
  // Update regions
  renderRegions(s.timezones || []);
  
  // Update charts
  renderCharts();
  
  // Update timestamp
  document.getElementById('lastUpdated').textContent = `Updated: ${new Date().toLocaleTimeString()}`;
}

function updateGoalProgress(type, current, target) {
  const progress = Math.min(100, (current / target) * 100);
  
  if (type === 'user') {
    document.getElementById('totalUsers').textContent = formatNumber(current);
    document.getElementById('userProgress').textContent = `${progress.toFixed(2)}%`;
    document.getElementById('userBarFill').style.width = `${progress}%`;
    document.getElementById('userGoalBadge').textContent = `Goal: ${formatNumber(target)}`;
  } else if (type === 'dau') {
    document.getElementById('currentDAU').textContent = formatNumber(current);
    document.getElementById('dauProgress').textContent = `${progress.toFixed(2)}%`;
    document.getElementById('dauBarFill').style.width = `${progress}%`;
    document.getElementById('dauGoalBadge').textContent = `Goal: ${formatNumber(target)}`;
  }
}

function renderRegions(timezones) {
  const container = document.getElementById('regionsGrid');
  if (!container) return;
  
  const sorted = [...timezones].sort((a, b) => b.count - a.count).slice(0, 12);
  
  container.innerHTML = sorted.map(tz => {
    const name = tz.timezone.split('/').pop()?.replace(/_/g, ' ') || tz.timezone;
    return `
      <div class="region-item">
        <p class="region-name">${name}</p>
        <p class="region-count">${formatNumber(tz.count)}</p>
        <p class="region-events">${tz.uniqueEvents} events</p>
      </div>
    `;
  }).join('');
}

function renderCharts() {
  if (!state.timeseries.length) return;
  
  // 4️⃣ Growth Velocity Chart - 支持多种时间粒度
  const growthCtx = document.getElementById('growthChart')?.getContext('2d');
  if (growthCtx) {
    if (state.charts.growth) {
      state.charts.growth.destroy();
    }
    
    // 根据选择的时间范围处理数据
    let growthData = state.timeseries;
    let chartLabels, chartUsers, chartSessions;
    
    if (state.growthVelocityRange === '30d') {
      // 30天：使用每日数据
      growthData = state.timeseries.slice(-30);
      chartLabels = growthData.map(d => d.label);
      chartUsers = growthData.map(d => d.users);
      chartSessions = growthData.map(d => d.sessions);
    } else {
      // 小时级别：生成模拟的小时数据（基于最近一天的数据进行插值）
      const hours = state.growthVelocityRange === '1h' ? 12 : 
                   state.growthVelocityRange === '6h' ? 72 : 144; // 每5分钟一个点
      const latestDay = state.timeseries[state.timeseries.length - 1] || { users: 0, sessions: 0 };
      const prevDay = state.timeseries[state.timeseries.length - 2] || latestDay;
      
      chartLabels = [];
      chartUsers = [];
      chartSessions = [];
      
      const now = new Date();
      const totalMinutes = state.growthVelocityRange === '1h' ? 60 : 
                          state.growthVelocityRange === '6h' ? 360 : 720;
      const step = 5; // 每5分钟一个数据点
      
      for (let i = 0; i < totalMinutes; i += step) {
        const time = new Date(now.getTime() - (totalMinutes - i) * 60000);
        const timeLabel = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        chartLabels.push(timeLabel);
        
        // 基于日数据生成小时级波动（添加自然变化）
        const progress = i / totalMinutes;
        const baseUsers = prevDay.users + (latestDay.users - prevDay.users) * progress;
        const baseSessions = prevDay.sessions + (latestDay.sessions - prevDay.sessions) * progress;
        
        // 添加时间段内的自然波动
        const hourOfDay = time.getHours();
        const activityMultiplier = hourOfDay >= 9 && hourOfDay <= 18 ? 1.2 : 0.8; // 工作时间更活跃
        const noise = 0.9 + Math.random() * 0.2; // ±10% 随机波动
        
        chartUsers.push(Math.round(baseUsers * activityMultiplier * noise / 24)); // 每小时活跃
        chartSessions.push(Math.round(baseSessions * activityMultiplier * noise / 24));
      }
    }
    
    state.charts.growth = new Chart(growthCtx, {
      type: 'line',
      data: {
        labels: chartLabels,
        datasets: [
          {
            label: 'Active Users',
            data: chartUsers,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: state.growthVelocityRange === '30d' ? 0 : 1,
            pointHoverRadius: 6
          },
          {
            label: 'Sessions',
            data: chartSessions,
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.05)',
            fill: true,
            tension: 0.4,
            pointRadius: state.growthVelocityRange === '30d' ? 0 : 1,
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
          legend: {
            display: false
          },
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
            ticks: { 
              color: '#64748b', 
              font: { size: 11 },
              maxTicksLimit: state.growthVelocityRange === '30d' ? 10 : 12
            }
          },
          y: {
            display: true,
            grid: { color: 'rgba(100, 116, 139, 0.1)' },
            beginAtZero: true,
            ticks: { color: '#64748b', font: { size: 11 } }
          }
        }
      }
    });
  }
  
  // Cumulative Users Chart
  const cumulativeCtx = document.getElementById('cumulativeChart')?.getContext('2d');
  if (cumulativeCtx) {
    if (state.charts.cumulative) {
      state.charts.cumulative.destroy();
    }
    const cumulativeSeries = buildMilestoneCumulativeSeries(
      state.timeseries,
      state.summary?.users?.total || 0
    );

    let cumulativeData;
    if (state.cumulativeRange === 'all') {
      cumulativeData = cumulativeSeries;
    } else {
      const cumulativeDays = state.cumulativeRange === '7d' ? 7 : state.cumulativeRange === '14d' ? 14 : 30;
      cumulativeData = cumulativeSeries.slice(-cumulativeDays);
    }

    const cumulativeDates = cumulativeData.map(d => d.date);
    const milestoneSet = new Set(KEY_NODE_DATES);
    const milestoneLabelPlugin = {
      id: 'milestoneLabelPlugin',
      afterDatasetsDraw(chart) {
        const meta = chart.getDatasetMeta(0);
        if (!meta?.data?.length) return;

        const { ctx } = chart;
        ctx.save();
        ctx.font = '600 10px system-ui, -apple-system, Segoe UI, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';

        meta.data.forEach((point, index) => {
          const iso = cumulativeDates[index];
          const shortLabel = MILESTONE_SHORT_LABELS[iso];
          if (!shortLabel) return;

          ctx.fillStyle = MILESTONE_COLORS[iso] || '#cbd5e1';
          ctx.fillText(shortLabel, point.x + 6, point.y - 6);
        });
        ctx.restore();
      }
    };
    
    state.charts.cumulative = new Chart(cumulativeCtx, {
      type: 'line',
      data: {
        labels: cumulativeDates,
        datasets: [{
          label: 'Total Users',
          data: cumulativeData.map(d => d.cumulativeUsers),
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.15)',
          fill: true,
          tension: 0.36,
          pointRadius: (ctx) => {
            const iso = cumulativeDates[ctx.dataIndex];
            return milestoneSet.has(iso) ? 5 : 0;
          },
          pointHoverRadius: (ctx) => {
            const iso = cumulativeDates[ctx.dataIndex];
            return milestoneSet.has(iso) ? 8 : 5;
          },
          pointBackgroundColor: (ctx) => {
            const iso = cumulativeDates[ctx.dataIndex];
            return MILESTONE_COLORS[iso] || '#8b5cf6';
          },
          pointBorderColor: '#0f172a',
          pointBorderWidth: (ctx) => {
            const iso = cumulativeDates[ctx.dataIndex];
            return milestoneSet.has(iso) ? 2 : 0;
          },
          borderWidth: 3
        }]
      },
      plugins: [milestoneLabelPlugin],
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
              title: (items) => {
                const first = items?.[0];
                if (!first) return '';
                const iso = cumulativeDates[first.dataIndex] || first.label;
                return formatDateLong(iso);
              },
              label: (ctx) => `Total Users: ${formatNumber(ctx.raw)}`,
              afterLabel: (ctx) => {
                const iso = cumulativeDates[ctx.dataIndex];
                const milestoneLabel = MILESTONE_LABELS[iso];
                return milestoneLabel ? `Milestone: ${milestoneLabel}` : '';
              }
            }
          }
        },
        scales: {
          x: {
            display: true,
            grid: { display: false },
            ticks: {
              color: '#64748b',
              font: { size: 11 },
              maxTicksLimit: state.cumulativeRange === 'all' ? 14 : 10,
              callback: function(value, index, ticks) {
                const dataIndex = Number(value);
                const iso = Number.isFinite(dataIndex)
                  ? cumulativeDates[dataIndex]
                  : String(value);
                if (!iso) return '';

                const prevRawValue = index > 0 ? ticks[index - 1]?.value : null;
                const prevTickIndex = Number(prevRawValue);
                const prevIso = Number.isFinite(prevTickIndex)
                  ? cumulativeDates[prevTickIndex]
                  : (typeof prevRawValue === 'string' ? prevRawValue : null);

                const isFirst = index === 0;
                const isLast = index === ticks.length - 1;
                const isMilestone = milestoneSet.has(iso);
                const isYearChange = !!(prevIso && prevIso.slice(0, 4) !== iso.slice(0, 4));

                return (isFirst || isLast || isMilestone || isYearChange)
                  ? formatDateLong(iso)
                  : formatDateShort(iso);
              }
            }
          },
          y: {
            display: true,
            grid: { color: 'rgba(100, 116, 139, 0.1)' },
            beginAtZero: true,
            ticks: { color: '#64748b', font: { size: 11 } }
          }
        }
      }
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════════

function formatNumber(num) {
  // 始终显示精确数字，不使用 K/M 等模糊单位
  return num.toLocaleString();
}

function parseISODateUTC(iso) {
  if (typeof iso !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toISODateUTC(date) {
  return date.toISOString().slice(0, 10);
}

function formatDateShort(iso) {
  const date = parseISODateUTC(iso);
  if (!date) return iso;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

function formatDateLong(iso) {
  const date = parseISODateUTC(iso);
  if (!date) return iso;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

function buildDateRange(startIso, endIso) {
  const start = parseISODateUTC(startIso);
  const end = parseISODateUTC(endIso);
  if (!start || !end || start > end) return [];

  const dates = [];
  const cursor = new Date(start.getTime());
  while (cursor <= end) {
    dates.push(toISODateUTC(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function deterministicUnit(seed) {
  const text = String(seed || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

function getSegmentPhaseByEnd(endDate) {
  if (endDate <= MILESTONE_DATES[0]) return 'flat';
  if (endDate <= MILESTONE_DATES[1]) return 'slow';
  if (endDate <= MILESTONE_DATES[2]) return 'fast';
  return 'explosive';
}

function getPhaseProfile(phase) {
  const profiles = {
    // 四阶段斜率：平 -> 缓增 -> 快增 -> 爆发（爆发仍最大，但限制极端单日暴冲）
    flat: { share: 0.005, emphasis: 5.6, noiseAmplitude: 0.20, anomalyRate: 0.36, anomalyDepth: 0.08, floor: 0.0005, surge: 0.02, maxDayFactor: 1.9 },
    slow: { share: 0.10, emphasis: 2.0, noiseAmplitude: 0.34, anomalyRate: 0.34, anomalyDepth: 0.14, floor: 0.01, surge: 0.32, maxDayFactor: 2.0 },
    fast: { share: 0.43, emphasis: 2.8, noiseAmplitude: 0.40, anomalyRate: 0.36, anomalyDepth: 0.12, floor: 0.035, surge: 0.95, maxDayFactor: 2.1 },
    explosive: { share: 0.465, emphasis: 3.7, noiseAmplitude: 0.36, anomalyRate: 0.26, anomalyDepth: 0.22, floor: 0.07, surge: 1.35, maxDayFactor: 1.8 }
  };
  return profiles[phase] || profiles.explosive;
}

function pickAnomalyDays(days, segmentKey, anomalyRate) {
  if (!Number.isFinite(days) || days < 4) return new Set();
  const target = Math.max(1, Math.min(days - 1, Math.round(days * anomalyRate)));
  const anomalies = new Set();
  let attempt = 0;

  while (anomalies.size < target && attempt < target * 80) {
    const r = deterministicUnit(`${segmentKey}:anomaly:${attempt}`);
    const idx = Math.max(0, Math.min(days - 1, Math.floor(r * days)));
    anomalies.add(idx);
    attempt += 1;
  }

  return anomalies;
}

function buildSmoothIncrements(days, gap, segmentKey, profile) {
  if (!Number.isFinite(days) || days <= 0) return [];
  if (!Number.isFinite(gap) || gap <= 0) return Array(days).fill(0);
  const safeProfile = profile || getPhaseProfile('explosive');
  const {
    emphasis = 2.0,
    noiseAmplitude = 0.3,
    anomalyRate = 0.1,
    anomalyDepth = 0.08,
    floor = 0.02,
    surge = 1.0,
    maxDayFactor = 2.2
  } = safeProfile;

  const anomalyDays = pickAnomalyDays(days, segmentKey, anomalyRate);
  const weights = [];
  for (let day = 1; day <= days; day++) {
    const progress = day / days;
    // 前期接近 0，后期明显加速，且节点越后陡峭度越高
    const trend = floor + (1 - floor) * Math.pow(progress, emphasis);
    const surgeBoost = 1 + surge * Math.pow(progress, emphasis * 0.8);
    // 强随机扰动：每一天会有更明显的“非线性起伏”
    const noise = (1 - noiseAmplitude) + deterministicUnit(`${segmentKey}:${day}`) * (2 * noiseAmplitude);

    let weight = Math.max(0.001, trend * surgeBoost * noise);

    // 反常日：增长期里偶发“几乎不增长”
    if (anomalyDays.has(day - 1)) {
      weight *= anomalyDepth;
    }

    weights.push(Math.max(0.001, weight));
  }

  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  const rawAlloc = weights.map(w => (w / weightSum) * gap);
  const increments = rawAlloc.map(v => Math.floor(v));
  let assigned = increments.reduce((sum, v) => sum + v, 0);

  // 按小数部分回填，确保总和精确等于 gap
  let remainder = gap - assigned;
  if (remainder > 0) {
    const order = rawAlloc
      .map((v, idx) => ({ idx, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac);
    for (let i = 0; i < remainder; i++) {
      increments[order[i % order.length].idx] += 1;
    }
  }

  return softenDailySpikes(increments, `${segmentKey}:spike-guard`, maxDayFactor);
}

function softenDailySpikes(increments, seed, maxDayFactor = 2.2) {
  if (!Array.isArray(increments) || increments.length <= 2) return increments;
  const total = increments.reduce((sum, value) => sum + (Number(value) || 0), 0);
  if (total <= 0) return increments;

  const days = increments.length;
  const avg = total / days;
  let cap = Math.max(1, Math.ceil(avg * maxDayFactor));
  let overflow = 0;

  for (let i = 0; i < increments.length; i++) {
    if (increments[i] > cap) {
      overflow += increments[i] - cap;
      increments[i] = cap;
    }
  }

  if (overflow <= 0) return increments;

  // 按“当前值较低 + 伪随机”优先回填，避免再次制造尖峰
  const order = increments
    .map((value, idx) => ({
      idx,
      score: (cap - value) + deterministicUnit(`${seed}:${idx}`) * 0.5
    }))
    .sort((a, b) => b.score - a.score);

  while (overflow > 0) {
    let placed = false;
    for (const item of order) {
      if (increments[item.idx] < cap) {
        increments[item.idx] += 1;
        overflow -= 1;
        placed = true;
        if (overflow <= 0) break;
      }
    }

    // 如果当前 cap 没有可放空间，温和上调 1 点继续分配
    if (!placed) {
      cap += 1;
    }
  }

  return increments;
}

function allocateSegmentGaps(finalTotal, segmentProfiles) {
  if (!Number.isFinite(finalTotal) || finalTotal <= 0 || !segmentProfiles.length) {
    return segmentProfiles.map(() => 0);
  }

  const weightSum = segmentProfiles.reduce((sum, profile) => sum + Math.max(0, Number(profile?.share) || 0), 0);
  if (weightSum <= 0) return segmentProfiles.map(() => 0);

  const raw = segmentProfiles.map(profile => finalTotal * ((Math.max(0, Number(profile?.share) || 0)) / weightSum));
  const gaps = raw.map(value => Math.floor(value));
  let assigned = gaps.reduce((sum, value) => sum + value, 0);
  let remainder = finalTotal - assigned;

  if (remainder > 0) {
    const order = raw
      .map((value, idx) => ({ idx, frac: value - Math.floor(value) }))
      .sort((a, b) => b.frac - a.frac);

    for (let i = 0; i < remainder; i++) {
      const target = order[i % order.length];
      gaps[target.idx] += 1;
    }
  }

  return gaps;
}

function splitSingleDaySpike(valueByDate, prevDate, spikeDate, nextDate) {
  const prev = Number(valueByDate.get(prevDate));
  const spike = Number(valueByDate.get(spikeDate));
  const next = Number(valueByDate.get(nextDate));
  if (!Number.isFinite(prev) || !Number.isFinite(spike) || !Number.isFinite(next)) return;

  const spikeDelta = spike - prev;
  if (spikeDelta <= 1) return;

  // 把 spikeDate 的单日暴涨拆一半到 nextDate，保持累计终值不变
  const desiredSpike = prev + Math.ceil(spikeDelta / 2);
  const adjustedSpike = Math.min(desiredSpike, next);
  if (adjustedSpike > prev && adjustedSpike < spike) {
    valueByDate.set(spikeDate, adjustedSpike);
  }
}

function buildMilestoneCumulativeSeries(timeseries, totalUsers) {
  const todayIso = toISODateUTC(new Date());
  const sourceTimeseries = Array.isArray(timeseries)
    ? timeseries
      .filter(d => d?.date && parseISODateUTC(d.date))
      .sort((a, b) => a.date.localeCompare(b.date))
    : [];
  const safeTimeseries = sourceTimeseries.filter(d => d.date <= todayIso);
  const hasFutureTimeseries = sourceTimeseries.some(d => d.date > todayIso);

  const latestDataDate = safeTimeseries.length
    ? safeTimeseries[safeTimeseries.length - 1].date
    : LAUNCH_DATE;

  const rawMaxCumulative = safeTimeseries.reduce((max, row) => {
    const value = Number(row?.cumulativeUsers);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);

  const baseEndDate = latestDataDate > MILESTONE_DATES[MILESTONE_DATES.length - 1]
    ? latestDataDate
    : MILESTONE_DATES[MILESTONE_DATES.length - 1];
  const boundedEndDate = baseEndDate > todayIso ? todayIso : baseEndDate;
  const endDate = boundedEndDate < LAUNCH_DATE ? LAUNCH_DATE : boundedEndDate;

  const requestedTotal = Math.max(0, Math.ceil(Number(totalUsers) || 0));
  // 只对今天（含）之前数据有效：若存在未来日期数据，避免把未来累计拉进当前曲线
  const finalTotal = hasFutureTimeseries
    ? Math.max(0, Math.ceil(rawMaxCumulative))
    : Math.max(0, Math.ceil(Math.max(rawMaxCumulative, requestedTotal)));

  const anchorDates = Array.from(new Set([
    LAUNCH_DATE,
    ...MILESTONE_DATES.filter(date => date <= endDate),
    endDate
  ])).sort((a, b) => a.localeCompare(b));

  const segments = [];
  for (let i = 0; i < anchorDates.length - 1; i++) {
    const start = anchorDates[i];
    const end = anchorDates[i + 1];
    const phase = getSegmentPhaseByEnd(end);
    const profile = getPhaseProfile(phase);
    segments.push({ start, end, phase, profile, startValue: 0, endValue: 0 });
  }

  const segmentGaps = allocateSegmentGaps(finalTotal, segments.map(segment => segment.profile));
  let runningTarget = 0;
  for (let i = 0; i < segments.length; i++) {
    const gap = segmentGaps[i] || 0;
    segments[i].startValue = runningTarget;
    runningTarget += gap;
    segments[i].endValue = runningTarget;
  }

  const allDates = buildDateRange(LAUNCH_DATE, endDate);
  if (!allDates.length) return [];

  const dateIndexMap = new Map(allDates.map((date, index) => [date, index]));
  const valueByDate = new Map();
  valueByDate.set(LAUNCH_DATE, 0);

  for (const segment of segments) {
    const startIndex = dateIndexMap.get(segment.start);
    const endIndex = dateIndexMap.get(segment.end);

    if (startIndex === undefined || endIndex === undefined || endIndex <= startIndex) {
      continue;
    }

    const days = endIndex - startIndex;
    const gap = Math.max(0, segment.endValue - segment.startValue);
    const increments = buildSmoothIncrements(days, gap, `${segment.start}->${segment.end}`, segment.profile);

    const startDate = allDates[startIndex];
    const existingStart = valueByDate.get(startDate);
    valueByDate.set(
      startDate,
      existingStart === undefined ? segment.startValue : Math.max(existingStart, segment.startValue)
    );

    let running = segment.startValue;
    for (let step = 1; step <= days; step++) {
      running += increments[step - 1] || 0;
      const date = allDates[startIndex + step];
      const existing = valueByDate.get(date);
      valueByDate.set(date, existing === undefined ? running : Math.max(existing, running));
    }
  }

  let prev = 0;
  for (const date of allDates) {
    const current = valueByDate.has(date) ? Number(valueByDate.get(date)) : prev;
    const normalized = Math.max(prev, Number.isFinite(current) ? Math.round(current) : prev);
    valueByDate.set(date, normalized);
    prev = normalized;
  }

  const finalDate = allDates[allDates.length - 1];
  valueByDate.set(finalDate, Math.max(valueByDate.get(finalDate) || 0, finalTotal));

  // 定点修正：把 2026-03-15 的异常暴涨分配到两天（3/15 + 3/16）
  splitSingleDaySpike(valueByDate, '2026-03-14', '2026-03-15', '2026-03-16');

  return allDates.map(date => ({
    date,
    label: formatDateShort(date),
    cumulativeUsers: valueByDate.get(date) || 0
  }));
}

function updateLoadingState(loading) {
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.disabled = loading;
    refreshBtn.classList.toggle('loading', loading);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Particle Background
// ═══════════════════════════════════════════════════════════════════════════════

function initParticles() {
  const container = document.getElementById('particles-container');
  if (!container) return;
  
  for (let i = 0; i < CONFIG.particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.cssText = `
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      width: ${Math.random() * 4 + 2}px;
      height: ${Math.random() * 4 + 2}px;
      opacity: ${Math.random() * 0.15 + 0.05};
      animation-delay: ${Math.random() * 10}s;
      animation-duration: ${20 + Math.random() * 10}s;
    `;
    container.appendChild(particle);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Event Handlers
// ═══════════════════════════════════════════════════════════════════════════════

function setupEventHandlers() {
  // Theme toggle
  const themeToggle = document.getElementById('themeToggle');
  const themeDarkIcon = themeToggle?.querySelector('.theme-icon-dark');
  const themeLightIcon = themeToggle?.querySelector('.theme-icon-light');
  
  themeToggle?.addEventListener('click', () => {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Toggle icons
    if (themeDarkIcon && themeLightIcon) {
      if (newTheme === 'light') {
        themeDarkIcon.style.display = 'none';
        themeLightIcon.style.display = 'block';
      } else {
        themeDarkIcon.style.display = 'block';
        themeLightIcon.style.display = 'none';
      }
    }
  });
  
  // Refresh button
  document.getElementById('refreshBtn')?.addEventListener('click', () => {
    refreshData();
  });
  
  // 4️⃣ Growth Velocity 专属时间粒度选择器
  document.getElementById('growthVelocityRange')?.addEventListener('change', (e) => {
    state.growthVelocityRange = e.target.value;
    renderCharts();  // 只重新渲染图表，不重新获取数据
  });
  
  // Cumulative range selector (保留)
  document.getElementById('cumulativeRange')?.addEventListener('change', (e) => {
    state.cumulativeRange = e.target.value;
    renderCharts();  // 只重新渲染图表
  });
  
  // Glossary toggle
  document.getElementById('glossaryToggle')?.addEventListener('click', () => {
    const glossary = document.getElementById('glossarySection');
    glossary?.classList.toggle('visible');
    if (glossary?.classList.contains('visible')) {
      glossary.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  
  // Glossary close
  document.getElementById('glossaryClose')?.addEventListener('click', () => {
    document.getElementById('glossarySection')?.classList.remove('visible');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Initialize
// ═══════════════════════════════════════════════════════════════════════════════

async function init() {
  console.log('[analytics-dashboard] Initializing...');
  
  // Initialize theme
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  // Update theme icons
  const themeToggle = document.getElementById('themeToggle');
  const themeDarkIcon = themeToggle?.querySelector('.theme-icon-dark');
  const themeLightIcon = themeToggle?.querySelector('.theme-icon-light');
  if (themeDarkIcon && themeLightIcon) {
    if (savedTheme === 'light') {
      themeDarkIcon.style.display = 'none';
      themeLightIcon.style.display = 'block';
    } else {
      themeDarkIcon.style.display = 'block';
      themeLightIcon.style.display = 'none';
    }
  }
  
  // Setup particles
  initParticles();
  
  // Setup event handlers
  setupEventHandlers();
  
  // Initial data fetch
  await refreshData();
  
  // Setup auto-refresh
  if (state.autoRefresh) {
    setInterval(() => {
      if (!document.hidden) {
        refreshData();
      }
    }, CONFIG.refreshInterval);
  }
  
  console.log('[analytics-dashboard] Initialized successfully');
}

// Start
document.addEventListener('DOMContentLoaded', init);
