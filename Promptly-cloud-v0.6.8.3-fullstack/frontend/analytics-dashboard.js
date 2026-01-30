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

// ═══════════════════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════════════════

let state = {
  summary: null,
  timeseries: [],
  loading: true,
  autoRefresh: true,
  timeRange: '14d',
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
    // Use the larger of timeRange or cumulativeRange for data fetching
    const getDays = (range) => range === '7d' ? 7 : range === '14d' ? 14 : range === '30d' ? 30 : 365;
    const days = Math.max(getDays(state.timeRange), getDays(state.cumulativeRange));
    const res = await fetch(`${CONFIG.apiBase}/api/analytics/dashboard/timeseries?days=${days}`);
    if (!res.ok) throw new Error('Failed to fetch timeseries');
    const data = await res.json();
    if (data.ok) {
      state.timeseries = data.data || [];
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
  document.getElementById('metricStickiness').textContent = `${s.activity?.dau_mau_ratio || 0}%`;
  document.getElementById('metricBounce').textContent = `${s.behavior?.bounceRate || 0}%`;
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
    document.getElementById('userProgress').textContent = `${progress.toFixed(1)}%`;
    document.getElementById('userBarFill').style.width = `${progress}%`;
    document.getElementById('userGoalBadge').textContent = `Goal: ${formatNumber(target)}`;
  } else if (type === 'dau') {
    document.getElementById('currentDAU').textContent = formatNumber(current);
    document.getElementById('dauProgress').textContent = `${progress.toFixed(1)}%`;
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
  
  // Growth Chart (Daily Active Users & Sessions)
  const growthCtx = document.getElementById('growthChart')?.getContext('2d');
  if (growthCtx) {
    if (state.charts.growth) {
      state.charts.growth.destroy();
    }
    
    state.charts.growth = new Chart(growthCtx, {
      type: 'line',
      data: {
        labels: state.timeseries.map(d => d.label),
        datasets: [
          {
            label: 'Active Users',
            data: state.timeseries.map(d => d.users),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 6
          },
          {
            label: 'Sessions',
            data: state.timeseries.map(d => d.sessions),
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.05)',
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
  
  // Cumulative Users Chart
  const cumulativeCtx = document.getElementById('cumulativeChart')?.getContext('2d');
  if (cumulativeCtx) {
    if (state.charts.cumulative) {
      state.charts.cumulative.destroy();
    }
    
    // Filter data based on cumulativeRange
    const cumulativeDays = state.cumulativeRange === '7d' ? 7 : state.cumulativeRange === '14d' ? 14 : state.cumulativeRange === '30d' ? 30 : 365;
    const cumulativeData = state.timeseries.slice(-cumulativeDays);
    
    state.charts.cumulative = new Chart(cumulativeCtx, {
      type: 'line',
      data: {
        labels: cumulativeData.map(d => d.label),
        datasets: [{
          label: 'Total Users',
          data: cumulativeData.map(d => d.cumulativeUsers),
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.15)',
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
}

// ═══════════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════════

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toLocaleString();
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
  // Refresh button
  document.getElementById('refreshBtn')?.addEventListener('click', () => {
    refreshData();
  });
  
  // Time range selector
  document.getElementById('timeRange')?.addEventListener('change', (e) => {
    state.timeRange = e.target.value;
    refreshData();
  });
  
  // Cumulative range selector
  document.getElementById('cumulativeRange')?.addEventListener('change', (e) => {
    state.cumulativeRange = e.target.value;
    refreshData();
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
