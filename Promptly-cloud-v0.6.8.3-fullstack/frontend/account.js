/**
 * Account Page JavaScript
 * 
 * Handles:
 * - Subscription status display
 * - Token balance visualization
 * - Usage history
 * - Billing portal access
 * - Logout
 */

(function() {
  const API_BASE = (window.PROMPTLY_API_BASE && window.PROMPTLY_API_BASE.trim()) || 
    (window.location && window.location.origin && window.location.origin !== "null" 
      ? window.location.origin 
      : "http://localhost:8080");

  // DOM Elements
  const loginRequired = document.getElementById('loginRequired');
  const accountContent = document.getElementById('accountContent');
  const subscriptionStatus = document.getElementById('subscriptionStatus');
  const planName = document.getElementById('planName');
  const periodEnd = document.getElementById('periodEnd');
  const trialEndItem = document.getElementById('trialEndItem');
  const trialEnd = document.getElementById('trialEnd');
  const cancelNotice = document.getElementById('cancelNotice');
  const manageSubscriptionBtn = document.getElementById('manageSubscriptionBtn');
  const totalTokens = document.getElementById('totalTokens');
  const dailyFreeTokens = document.getElementById('dailyFreeTokens');
  const monthlyTokens = document.getElementById('monthlyTokens');
  const trialBucket = document.getElementById('trialBucket');
  const trialTokens = document.getElementById('trialTokens');
  const dailyFreeBar = document.getElementById('dailyFreeBar');
  const monthlyBar = document.getElementById('monthlyBar');
  const trialBar = document.getElementById('trialBar');
  const usageHistory = document.getElementById('usageHistory');
  const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const userEmail = document.getElementById('userEmail');
  const memberSince = document.getElementById('memberSince');
  const logoutBtn = document.getElementById('logoutBtn');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const toastContainer = document.getElementById('toastContainer');

  // State
  let authToken = null;
  let historyOffset = 0;
  const historyLimit = 20;

  // Token limits for progress bars
  const TOKEN_LIMITS = {
    daily_free: 50000,
    monthly: 1000000,
    trial_base: 200000,
  };

  // =============================================
  // Initialization
  // =============================================

  async function init() {
    setupThemeToggle();
    setupEventListeners();
    
    // Check authentication - use unified authState if available
    if (window.authState && window.authState.getToken) {
      authToken = window.authState.getToken();
      // Fetch user info if needed
      if (authToken && !window.authState.getUser()) {
        await window.authState.fetchUserInfo();
      }
    } else {
      authToken = localStorage.getItem('promptly.token');
    }
    
    if (!authToken) {
      showLoginRequired();
      return;
    }
    
    showAccountContent();
    await loadAccountData();
  }

  // =============================================
  // API Calls
  // =============================================

  async function apiCall(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Request failed');
    }
    
    return data;
  }

  async function loadAccountData() {
    showLoading(true);
    
    try {
      const [statusData, historyData] = await Promise.all([
        apiCall('/api/billing/status'),
        apiCall(`/api/billing/token-history?limit=${historyLimit}&offset=0`),
      ]);
      
      updateStatusDisplay(statusData);
      updateHistoryDisplay(historyData.history);
      
    } catch (err) {
      console.error('Failed to load account data:', err);
      
      if (err.message.includes('token') || err.message.includes('auth') || err.message.includes('401')) {
        // Auth failed, clear and redirect
        localStorage.removeItem('promptly.token');
        showLoginRequired();
        return;
      }
      
      showToast('error', 'Failed to load account data. Please try again.');
    } finally {
      showLoading(false);
    }
  }

  async function loadMoreHistory() {
    historyOffset += historyLimit;
    
    try {
      const data = await apiCall(`/api/billing/token-history?limit=${historyLimit}&offset=${historyOffset}`);
      appendHistoryEntries(data.history);
      
      if (!data.pagination.hasMore) {
        loadMoreBtn.style.display = 'none';
      }
    } catch (err) {
      console.error('Failed to load more history:', err);
      showToast('error', 'Failed to load more history.');
    }
  }

  async function openBillingPortal() {
    showLoading(true);
    
    try {
      const result = await apiCall('/api/billing/portal-session', {
        method: 'POST',
      });
      
      window.location.href = result.url;
      
    } catch (err) {
      console.error('Failed to open billing portal:', err);
      showToast('error', err.message || 'Failed to open billing portal.');
      showLoading(false);
    }
  }

  // =============================================
  // UI Updates
  // =============================================

  function showLoginRequired() {
    loginRequired.classList.remove('hidden');
    accountContent.classList.add('hidden');
  }

  function showAccountContent() {
    loginRequired.classList.add('hidden');
    accountContent.classList.remove('hidden');
  }

  function updateStatusDisplay(data) {
    const { subscription, tokens, user } = data;
    
    // Subscription Status
    subscriptionStatus.textContent = getStatusText(subscription.status);
    subscriptionStatus.className = `status-badge ${subscription.status}`;
    
    // Plan Name
    planName.textContent = subscription.plan 
      ? capitalizeFirst(subscription.plan)
      : 'None';
    
    // Period End
    if (subscription.periodEnd) {
      periodEnd.textContent = formatDate(subscription.periodEnd);
    } else {
      periodEnd.textContent = '--';
    }
    
    // Trial End
    if (subscription.status === 'trialing' && subscription.trialEnd) {
      trialEndItem.style.display = 'flex';
      trialEnd.textContent = formatDate(subscription.trialEnd);
      if (subscription.trialDaysRemaining !== null) {
        trialEnd.textContent += ` (${subscription.trialDaysRemaining} days left)`;
      }
    } else {
      trialEndItem.style.display = 'none';
    }
    
    // Cancel Notice
    if (subscription.cancelAtPeriodEnd) {
      cancelNotice.style.display = 'block';
    } else {
      cancelNotice.style.display = 'none';
    }
    
    // Manage Button
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      manageSubscriptionBtn.style.display = 'inline-flex';
    } else {
      manageSubscriptionBtn.style.display = 'none';
    }
    
    // Token Balances
    totalTokens.textContent = formatTokens(tokens.total);
    dailyFreeTokens.textContent = formatTokens(tokens.daily_free);
    monthlyTokens.textContent = formatTokens(tokens.monthly);
    
    // Progress Bars
    dailyFreeBar.style.width = `${Math.min(100, (tokens.daily_free / TOKEN_LIMITS.daily_free) * 100)}%`;
    monthlyBar.style.width = `${Math.min(100, (tokens.monthly / TOKEN_LIMITS.monthly) * 100)}%`;
    
    // Trial Tokens (if applicable)
    if (tokens.trial_base > 0) {
      trialBucket.style.display = 'block';
      trialTokens.textContent = formatTokens(tokens.trial_base);
      trialBar.style.width = `${Math.min(100, (tokens.trial_base / TOKEN_LIMITS.trial_base) * 100)}%`;
    } else {
      trialBucket.style.display = 'none';
    }
    
    // User Info
    userEmail.textContent = user.email || '--';
    memberSince.textContent = user.createdAt ? formatDate(user.createdAt) : '--';
  }

  function updateHistoryDisplay(entries) {
    if (!entries || entries.length === 0) {
      usageHistory.innerHTML = `
        <div class="empty-history">
          <p data-i18n="account.no_history">No usage history yet.</p>
        </div>
      `;
      loadMoreBtn.style.display = 'none';
      return;
    }
    
    usageHistory.innerHTML = entries.map(entry => createHistoryEntry(entry)).join('');
    loadMoreBtn.style.display = 'block';
    historyOffset = 0;
  }

  function appendHistoryEntries(entries) {
    if (!entries || entries.length === 0) return;
    
    const html = entries.map(entry => createHistoryEntry(entry)).join('');
    usageHistory.insertAdjacentHTML('beforeend', html);
  }

  function createHistoryEntry(entry) {
    const isPositive = entry.change > 0;
    const changeClass = isPositive ? 'positive' : 'negative';
    
    return `
      <div class="usage-entry">
        <div class="usage-info">
          <span class="usage-reason">${escapeHtml(entry.reason || 'Token change')}</span>
          <span class="usage-time">${formatDateTime(entry.createdAt)}</span>
          <span class="usage-bucket">${formatBucket(entry.bucket)}</span>
        </div>
        <span class="usage-change ${changeClass}">${formatTokens(Math.abs(entry.change))}</span>
      </div>
    `;
  }

  // =============================================
  // Event Handlers
  // =============================================

  function setupEventListeners() {
    // Manage Subscription
    manageSubscriptionBtn.addEventListener('click', openBillingPortal);
    
    // Refresh History
    refreshHistoryBtn.addEventListener('click', async () => {
      historyOffset = 0;
      usageHistory.innerHTML = '<div class="loading-placeholder">Loading...</div>';
      try {
        const data = await apiCall(`/api/billing/token-history?limit=${historyLimit}&offset=0`);
        updateHistoryDisplay(data.history);
      } catch (err) {
        showToast('error', 'Failed to refresh history.');
      }
    });
    
    // Load More History
    loadMoreBtn.addEventListener('click', loadMoreHistory);
    
    // Logout
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('promptly.token');
      localStorage.removeItem('promptly.user');
      showToast('success', 'Logged out successfully.');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1000);
    });
    
    // OAuth buttons in login-required section
    const googleLoginBtnAccount = document.getElementById('googleLoginBtnAccount');
    const githubLoginBtnAccount = document.getElementById('githubLoginBtnAccount');
    
    googleLoginBtnAccount?.addEventListener('click', () => {
      if (window.oauth && window.oauth.signInWithGoogle) {
        window.oauth.signInWithGoogle();
      } else {
        console.error("OAuth library not loaded");
        showToast('error', 'OAuth not available. Please refresh the page.');
      }
    });
    
    githubLoginBtnAccount?.addEventListener('click', () => {
      if (window.oauth && window.oauth.signInWithGitHub) {
        window.oauth.signInWithGitHub();
      } else {
        console.error("OAuth library not loaded");
        showToast('error', 'OAuth not available. Please refresh the page.');
      }
    });
  }

  function setupThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    
    const themeIcon = themeToggle.querySelector('.theme-icon');
    const currentTheme = document.documentElement.getAttribute('data-theme');
    
    updateThemeIcon(themeIcon, currentTheme);
    
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('promptly.theme', next);
      updateThemeIcon(themeIcon, next);
    });
  }

  function updateThemeIcon(icon, theme) {
    if (icon) {
      icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }

  // =============================================
  // Utilities
  // =============================================

  function showLoading(show) {
    if (show) {
      loadingOverlay.classList.remove('hidden');
    } else {
      loadingOverlay.classList.add('hidden');
    }
  }

  function showToast(type, message) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 5000);
  }

  function getStatusText(status) {
    const statusMap = {
      'none': 'No Subscription',
      'trialing': 'Trial Active',
      'active': 'Active',
      'past_due': 'Past Due',
      'canceled': 'Canceled',
      'unpaid': 'Unpaid',
    };
    return statusMap[status] || status;
  }

  function formatTokens(tokens) {
    if (tokens === null || tokens === undefined) return '--';
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}K`;
    }
    return tokens.toString();
  }

  function formatDate(dateString) {
    if (!dateString) return '--';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function formatDateTime(dateString) {
    if (!dateString) return '--';
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatBucket(bucket) {
    const bucketMap = {
      'daily_free': 'Daily Free',
      'monthly': 'Monthly',
      'trial_base': 'Trial',
      'adjustment': 'Adjustment',
    };
    return bucketMap[bucket] || bucket;
  }

  function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // =============================================
  // Initialize
  // =============================================

  // Wait for DOM and i18n
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
