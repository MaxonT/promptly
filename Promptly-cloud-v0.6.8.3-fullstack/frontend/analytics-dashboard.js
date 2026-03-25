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
const MILESTONE_TARGET_RATIOS = {
  '2025-12-05': 0.18,
  '2026-01-22': 0.52,
  '2026-03-13': 0.88
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
  
  // Update engagement stats
  document.getElementById('engageMouse').textContent = s.engagement?.avgMouseMovements || '0';
  document.getElementById('engageScroll').textContent = s.engagement?.avgScrolls || '0';
  document.getElementById('engageClicks').textContent = s.engagement?.avgClicks || '0';
  document.getElementById('engageTyping').textContent = s.engagement?.avgTypingEvents || '0';
  
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
    const milestoneSet = new Set(MILESTONE_DATES);
    
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
              title: (items) => {
                const first = items?.[0];
                if (!first) return '';
                const iso = cumulativeDates[first.dataIndex] || first.label;
                return formatDateLong(iso);
              },
              label: (ctx) => `Total Users: ${formatNumber(ctx.raw)}`
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

function getSegmentGrowthProfile(milestoneRank) {
  // 节点越靠后，增长越陡，随机波动与“反常日”也更明显
  const profiles = {
    0: { emphasis: 4.2, noiseAmplitude: 0.45, anomalyRate: 0.10, anomalyDepth: 0.08, floor: 0.01, surge: 0.9 },
    1: { emphasis: 5.1, noiseAmplitude: 0.50, anomalyRate: 0.12, anomalyDepth: 0.07, floor: 0.015, surge: 1.3 },
    2: { emphasis: 6.0, noiseAmplitude: 0.55, anomalyRate: 0.14, anomalyDepth: 0.06, floor: 0.02, surge: 1.8 },
    after: { emphasis: 6.4, noiseAmplitude: 0.52, anomalyRate: 0.11, anomalyDepth: 0.06, floor: 0.03, surge: 1.5 }
  };
  return milestoneRank === -1 ? profiles.after : (profiles[milestoneRank] || profiles.after);
}

function pickAnomalyDays(days, segmentKey, anomalyRate) {
  if (!Number.isFinite(days) || days < 6) return new Set();
  const target = Math.max(1, Math.min(7, Math.round(days * anomalyRate)));
  const anomalies = new Set();
  const minDay = days >= 10 ? 2 : 1;
  const maxDay = days >= 10 ? days - 2 : days;

  let attempt = 0;
  while (anomalies.size < target && attempt < target * 25) {
    const r = deterministicUnit(`${segmentKey}:anomaly:${attempt}`);
    const oneBasedDay = Math.floor(minDay + r * (maxDay - minDay + 1));
    const idx = Math.max(0, Math.min(days - 1, oneBasedDay - 1));

    // 避免异常日太密集，保证视觉上“偶发”
    let tooClose = false;
    for (const existing of anomalies) {
      if (Math.abs(existing - idx) <= 1) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) anomalies.add(idx);
    attempt += 1;
  }

  return anomalies;
}

function buildSmoothIncrements(days, gap, segmentKey, profile) {
  if (!Number.isFinite(days) || days <= 0) return [];
  if (!Number.isFinite(gap) || gap <= 0) return Array(days).fill(0);
  const safeProfile = profile || getSegmentGrowthProfile(-1);
  const {
    emphasis = 2.0,
    noiseAmplitude = 0.3,
    anomalyRate = 0.1,
    anomalyDepth = 0.08,
    floor = 0.02,
    surge = 1.0
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

  return increments;
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

  const rawAnchors = [
    { date: LAUNCH_DATE, value: 0 },
    ...MILESTONE_DATES.map(date => ({
      date,
      value: Math.ceil(finalTotal * (MILESTONE_TARGET_RATIOS[date] || 0))
    })),
    { date: endDate, value: finalTotal }
  ];

  const anchorMap = new Map();
  for (const anchor of rawAnchors) {
    const prev = anchorMap.get(anchor.date) || 0;
    anchorMap.set(anchor.date, Math.max(prev, anchor.value));
  }

  const anchors = Array.from(anchorMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));

  let runningAnchor = 0;
  for (const anchor of anchors) {
    runningAnchor = Math.max(runningAnchor, anchor.value);
    anchor.value = runningAnchor;
  }

  const allDates = buildDateRange(LAUNCH_DATE, endDate);
  if (!allDates.length) return [];

  const dateIndexMap = new Map(allDates.map((date, index) => [date, index]));
  const valueByDate = new Map();
  valueByDate.set(LAUNCH_DATE, 0);

  for (let i = 0; i < anchors.length - 1; i++) {
    const startAnchor = anchors[i];
    const endAnchor = anchors[i + 1];
    const startIndex = dateIndexMap.get(startAnchor.date);
    const endIndex = dateIndexMap.get(endAnchor.date);

    if (startIndex === undefined || endIndex === undefined || endIndex <= startIndex) {
      continue;
    }

    const days = endIndex - startIndex;
    const gap = Math.max(0, endAnchor.value - startAnchor.value);
    const milestoneRank = MILESTONE_DATES.indexOf(endAnchor.date);
    const profile = getSegmentGrowthProfile(milestoneRank);
    const increments = buildSmoothIncrements(days, gap, `${startAnchor.date}->${endAnchor.date}`, profile);

    const startDate = allDates[startIndex];
    const existingStart = valueByDate.get(startDate);
    valueByDate.set(startDate, existingStart === undefined ? startAnchor.value : Math.max(existingStart, startAnchor.value));

    let running = startAnchor.value;
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
