/**
 * Subscription Page JavaScript
 * 
 * Handles:
 * - Plan display and selection
 * - Stripe Checkout integration
 * - Trial start
 * - Status display
 */

(function() {
  const API_BASE = (window.PROMPTLY_API_BASE && window.PROMPTLY_API_BASE.trim()) || 
    (window.location && window.location.origin && window.location.origin !== "null" 
      ? window.location.origin 
      : "http://localhost:8080");

  // DOM Elements
  const statusBanner = document.getElementById('statusBanner');
  const trialBanner = document.getElementById('trialBanner');
  const statusValue = document.getElementById('statusValue');
  const tokenValue = document.getElementById('tokenValue');
  const startTrialBtn = document.getElementById('startTrialBtn');
  const monthlyToggle = document.getElementById('monthlyToggle');
  const yearlyToggle = document.getElementById('yearlyToggle');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const toastContainer = document.getElementById('toastContainer');
  const subscribeButtons = document.querySelectorAll('.subscribe-btn');
  const pricingCards = document.querySelectorAll('.pricing-card');

  // State
  let currentPlan = 'monthly';
  let billingStatus = null;
  let authToken = null;

  // =============================================
  // Initialization
  // =============================================

  async function init() {
    setupThemeToggle();
    setupBillingToggle();
    setupSubscribeButtons();
    setupTrialButton();
    
    // Check authentication
    authToken = localStorage.getItem('promptly.token');
    
    if (authToken) {
      await loadBillingStatus();
    } else {
      // Show trial banner for non-logged-in users
      showTrialBanner(true);
    }
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

  async function loadBillingStatus() {
    try {
      billingStatus = await apiCall('/api/billing/status');
      updateStatusDisplay();
    } catch (err) {
      console.error('Failed to load billing status:', err);
      // If auth fails, clear token and show trial banner
      if (err.message.includes('token') || err.message.includes('auth')) {
        localStorage.removeItem('promptly.token');
        authToken = null;
        showTrialBanner(true);
      }
    }
  }

  async function startTrial() {
    showLoading(true);
    
    try {
      // Get fingerprint (simple implementation - can be enhanced)
      const fingerprint = await getFingerprint();
      
      const result = await apiCall('/api/billing/start-trial', {
        method: 'POST',
        body: JSON.stringify({ fingerprint }),
      });
      
      if (result.requiresPaymentMethod) {
        // Redirect to Stripe checkout
        window.location.href = result.checkoutUrl;
        return;
      }
      
      showToast('success', 'Trial started successfully! You now have access to all features.');
      await loadBillingStatus();
      
    } catch (err) {
      console.error('Failed to start trial:', err);
      showToast('error', err.message || 'Failed to start trial. Please try again.');
    } finally {
      showLoading(false);
    }
  }

  async function subscribe(plan) {
    if (!authToken) {
      // Redirect to login
      window.location.href = 'index.html?login=1&redirect=subscription';
      return;
    }
    
    showLoading(true);
    
    try {
      const result = await apiCall('/api/billing/checkout-session', {
        method: 'POST',
        body: JSON.stringify({ plan }),
      });
      
      // Redirect to Stripe Checkout
      window.location.href = result.url;
      
    } catch (err) {
      console.error('Failed to create checkout session:', err);
      showToast('error', err.message || 'Failed to start checkout. Please try again.');
      showLoading(false);
    }
  }

  // =============================================
  // UI Updates
  // =============================================

  function updateStatusDisplay() {
    if (!billingStatus) return;
    
    const { subscription, tokens } = billingStatus;
    
    // Show status banner
    statusBanner.classList.remove('hidden');
    
    // Update status value
    const statusText = getStatusText(subscription.status);
    statusValue.textContent = statusText;
    statusValue.className = `status-value ${subscription.status}`;
    
    // Update token value
    tokenValue.textContent = tokens.totalFormatted;
    
    // Show/hide trial banner based on eligibility
    showTrialBanner(subscription.canStartTrial && subscription.status === 'none');
    
    // Update subscribe buttons based on current status
    updateSubscribeButtons(subscription);
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

  function showTrialBanner(show) {
    if (show) {
      trialBanner.classList.remove('hidden');
    } else {
      trialBanner.classList.add('hidden');
    }
  }

  function updateSubscribeButtons(subscription) {
    subscribeButtons.forEach(btn => {
      if (subscription.status === 'active' || subscription.status === 'trialing') {
        btn.textContent = window.i18n ? window.i18n.t('subscription.manage') : 'Manage';
        btn.onclick = () => openBillingPortal();
      }
    });
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
  // Event Handlers
  // =============================================

  function setupBillingToggle() {
    monthlyToggle.addEventListener('click', () => {
      currentPlan = 'monthly';
      monthlyToggle.classList.add('active');
      yearlyToggle.classList.remove('active');
      updatePlanDisplay();
    });
    
    yearlyToggle.addEventListener('click', () => {
      currentPlan = 'yearly';
      yearlyToggle.classList.add('active');
      monthlyToggle.classList.remove('active');
      updatePlanDisplay();
    });
  }

  function updatePlanDisplay() {
    pricingCards.forEach(card => {
      const plan = card.dataset.plan;
      if (currentPlan === 'monthly') {
        card.style.display = plan === 'monthly' ? 'block' : 'block';
      } else {
        card.style.display = plan === 'yearly' ? 'block' : 'block';
      }
      
      // Highlight selected plan
      if (plan === currentPlan) {
        card.classList.add('featured');
      } else {
        card.classList.remove('featured');
        // Keep yearly always featured
        if (plan === 'yearly') {
          card.classList.add('featured');
        }
      }
    });
  }

  function setupSubscribeButtons() {
    subscribeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const plan = btn.dataset.plan;
        subscribe(plan);
      });
    });
  }

  function setupTrialButton() {
    if (startTrialBtn) {
      startTrialBtn.addEventListener('click', () => {
        if (!authToken) {
          // Redirect to login/register
          window.location.href = 'index.html?register=1&redirect=subscription&trial=1';
          return;
        }
        startTrial();
      });
    }
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

  async function getFingerprint() {
    // Simple fingerprint based on available browser info
    // In production, consider using FingerprintJS or similar
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 'unknown',
    ];
    
    const text = components.join('|');
    
    // Simple hash
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return hash.toString(36);
  }

  // =============================================
  // URL Parameter Handling (for success/cancel redirects)
  // =============================================

  function handleUrlParams() {
    const params = new URLSearchParams(window.location.search);
    
    if (params.has('session_id')) {
      // Returning from successful checkout
      showToast('success', 'Subscription activated! Your payment is being processed.');
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    if (params.has('canceled')) {
      showToast('error', 'Checkout was canceled. You can try again anytime.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  // =============================================
  // Initialize
  // =============================================

  // Wait for i18n to be ready if available
  if (window.i18n) {
    window.i18n.on('initialized', () => {
      init();
      handleUrlParams();
    });
    
    // Fallback if already initialized
    setTimeout(() => {
      init();
      handleUrlParams();
    }, 500);
  } else {
    // No i18n, initialize immediately
    document.addEventListener('DOMContentLoaded', () => {
      init();
      handleUrlParams();
    });
  }
})();
