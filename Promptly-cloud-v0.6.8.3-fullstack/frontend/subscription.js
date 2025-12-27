/**
 * Subscription Page JavaScript (v2 - with State Machine & Auth Modal)
 * 
 * Handles:
 * - Auth Modal flow (inline login/register)
 * - Subscription State Machine integration
 * - Analytics tracking
 * - Stripe Checkout with idempotency
 * - Trial start
 * - Status display
 */

import { SubscriptionStateMachine, SubscriptionState } from './lib/subscriptionStateMachine.js';
import { track, EVENTS } from './lib/analytics.js';

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
  
  // Auth Modal Elements
  const authModal = document.getElementById('authModal');
  const authModalClose = authModal?.querySelector('.auth-modal-close');
  const showLoginBtn = document.getElementById('showLoginBtn');
  const showRegisterBtn = document.getElementById('showRegisterBtn');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const stepper = document.querySelector('.checkout-stepper');

  // State
  let currentPlan = 'monthly';
  let billingStatus = null;
  let authToken = null;
  let stateMachine = null;
  let selectedPlan = null;
  let idempotencyKey = null;

  // =============================================
  // Initialization
  // =============================================

  async function init() {
    setupThemeToggle();
    setupBillingToggle();
    setupSubscribeButtons();
    setupTrialButton();
    setupAuthModal();
    
    // Check authentication
    authToken = localStorage.getItem('promptly.token');
    
    // Initialize State Machine
    stateMachine = new SubscriptionStateMachine();
    stateMachine.on('stateChange', handleStateChange);
    
    if (authToken) {
      await loadBillingStatus();
    } else {
      showTrialBanner(true);
    }
    
    // Check for interrupted flow
    recoverInterruptedFlow();
  }

  // =============================================
  // State Machine Handlers
  // =============================================

  function handleStateChange(oldState, newState) {
    console.log(`[subscription] State: ${oldState} → ${newState}`);
    track(EVENTS.STATE_CHANGE, { from: oldState, to: newState });
    
    updateStepperUI(newState);
    
    // State-specific actions
    switch (newState) {
      case SubscriptionState.AUTH_MODAL:
        showAuthModal();
        break;
      case SubscriptionState.CREATING_CHECKOUT:
        createCheckoutSession();
        break;
      case SubscriptionState.ERROR:
        const error = stateMachine.getState().error;
        const errorMessage = error || 'An error occurred';
        
        // Show detailed error toast with retry option
        showErrorToast(errorMessage, () => {
          // Retry callback
          if (selectedPlan) {
            stateMachine.transitionTo(SubscriptionState.IDLE);
            subscribe(selectedPlan);
          }
        });
        
        stateMachine.transitionTo(SubscriptionState.IDLE);
        break;
    }
  }

  function updateStepperUI(state) {
    if (!stepper) return;
    
    const steps = stepper.querySelectorAll('.step');
    steps.forEach(step => {
      step.classList.remove('active', 'completed');
    });
    
    // Map states to stepper steps
    if ([SubscriptionState.CHECK_AUTH, SubscriptionState.AUTH_MODAL].includes(state)) {
      steps[0]?.classList.add('active');
    } else if ([SubscriptionState.CREATING_CHECKOUT, SubscriptionState.CHECKOUT_REDIRECT].includes(state)) {
      steps[0]?.classList.add('completed');
      steps[1]?.classList.add('active');
    } else if ([SubscriptionState.CONFIRMING_PAYMENT, SubscriptionState.ACTIVATED].includes(state)) {
      steps[0]?.classList.add('completed');
      steps[1]?.classList.add('completed');
      steps[2]?.classList.add('active');
    }
  }

  function recoverInterruptedFlow() {
    const saved = sessionStorage.getItem('subscription_pending');
    if (!saved) return;
    
    try {
      const data = JSON.parse(saved);
      const { plan, sessionId, timestamp } = data;
      
      // Only recover if less than 1 hour old
      if (Date.now() - timestamp < 3600000 && authToken) {
        console.log('[subscription] Recovering interrupted flow', data);
        selectedPlan = plan;
        stateMachine.transitionTo(SubscriptionState.CHECK_AUTH);
        track(EVENTS.CHECKOUT_FLOW_RECOVERED, { plan, sessionId });
      } else {
        sessionStorage.removeItem('subscription_pending');
      }
    } catch (err) {
      console.error('[subscription] Failed to recover flow:', err);
      sessionStorage.removeItem('subscription_pending');
    }
  }

  // =============================================
  // Auth Modal
  // =============================================

  function setupAuthModal() {
    // Close button
    authModalClose?.addEventListener('click', () => {
      hideAuthModal();
      stateMachine.transitionTo(SubscriptionState.IDLE);
    });
    
    // Click outside to close
    authModal?.addEventListener('click', (e) => {
      if (e.target === authModal) {
        hideAuthModal();
        stateMachine.transitionTo(SubscriptionState.IDLE);
      }
    });
    
    // Toggle between login/register
    showLoginBtn?.addEventListener('click', () => {
      loginForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
      showLoginBtn.classList.add('active');
      showRegisterBtn.classList.remove('active');
      track(EVENTS.AUTH_TAB_SWITCHED, { tab: 'login' });
    });
    
    showRegisterBtn?.addEventListener('click', () => {
      registerForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
      showRegisterBtn.classList.add('active');
      showLoginBtn.classList.remove('active');
      track(EVENTS.AUTH_TAB_SWITCHED, { tab: 'register' });
    });
    
    // Form submissions
    loginForm?.addEventListener('submit', handleLogin);
    registerForm?.addEventListener('submit', handleRegister);
  }

  function showAuthModal() {
    authModal?.classList.remove('hidden');
    track(EVENTS.AUTH_MODAL_OPENED, { plan: selectedPlan });
  }

  function hideAuthModal() {
    authModal?.classList.add('hidden');
    track(EVENTS.AUTH_MODAL_CLOSED);
  }

  async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    showLoading(true);
    track(EVENTS.AUTH_LOGIN_ATTEMPTED, { email });
    
    try {
      const result = await apiCall('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      
      localStorage.setItem('promptly.token', result.token);
      authToken = result.token;
      
      track(EVENTS.AUTH_LOGIN_SUCCESS, { email });
      hideAuthModal();
      
      // Continue with checkout
      stateMachine.transitionTo(SubscriptionState.CREATING_CHECKOUT);
      
    } catch (err) {
      console.error('Login failed:', err);
      showToast('error', err.message || 'Login failed');
      track(EVENTS.AUTH_LOGIN_FAILED, { email, error: err.message });
    } finally {
      showLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirm = document.getElementById('registerConfirm').value;
    
    if (password !== confirm) {
      showToast('error', 'Passwords do not match');
      return;
    }
    
    showLoading(true);
    track(EVENTS.AUTH_REGISTER_ATTEMPTED, { email });
    
    try {
      const result = await apiCall('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      
      localStorage.setItem('promptly.token', result.token);
      authToken = result.token;
      
      track(EVENTS.AUTH_REGISTER_SUCCESS, { email });
      hideAuthModal();
      
      // Continue with checkout
      stateMachine.transitionTo(SubscriptionState.CREATING_CHECKOUT);
      
    } catch (err) {
      console.error('Registration failed:', err);
      showToast('error', err.message || 'Registration failed');
      track(EVENTS.AUTH_REGISTER_FAILED, { email, error: err.message });
    } finally {
      showLoading(false);
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
      if (err.message.includes('token') || err.message.includes('auth')) {
        localStorage.removeItem('promptly.token');
        authToken = null;
        showTrialBanner(true);
      }
    }
  }

  async function startTrial() {
    track(EVENTS.TRIAL_START_CLICKED);
    
    if (!authToken) {
      selectedPlan = 'trial';
      stateMachine.transitionTo(SubscriptionState.CHECK_AUTH);
      stateMachine.transitionTo(SubscriptionState.AUTH_MODAL);
      return;
    }
    
    showLoading(true);
    
    try {
      const fingerprint = await getFingerprint();
      
      const result = await apiCall('/api/billing/start-trial', {
        method: 'POST',
        body: JSON.stringify({ fingerprint }),
      });
      
      if (result.requiresPaymentMethod) {
        window.location.href = result.checkoutUrl;
        return;
      }
      
      showToast('success', 'Trial started successfully!');
      track(EVENTS.TRIAL_STARTED);
      await loadBillingStatus();
      
    } catch (err) {
      console.error('Failed to start trial:', err);
      showToast('error', err.message || 'Failed to start trial');
      track(EVENTS.TRIAL_START_FAILED, { error: err.message });
    } finally {
      showLoading(false);
    }
  }

  async function subscribe(plan) {
    selectedPlan = plan;
    track(EVENTS.SUBSCRIBE_CLICKED, { plan });
    
    // Check auth
    stateMachine.transitionTo(SubscriptionState.CHECK_AUTH);
    
    if (!authToken) {
      stateMachine.transitionTo(SubscriptionState.AUTH_MODAL);
      return;
    }
    
    // Proceed to checkout
    stateMachine.transitionTo(SubscriptionState.CREATING_CHECKOUT);
  }

  async function createCheckoutSession() {
    showLoading(true);
    track(EVENTS.CHECKOUT_SESSION_CREATING, { plan: selectedPlan });
    
    try {
      // Generate idempotency key
      idempotencyKey = `checkout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const result = await apiCall('/api/billing/checkout-session', {
        method: 'POST',
        body: JSON.stringify({ 
          plan: selectedPlan,
          idempotencyKey,
        }),
      });
      
      // Save pending state
      sessionStorage.setItem('subscription_pending', JSON.stringify({
        plan: selectedPlan,
        sessionId: result.sessionId,
        idempotencyKey,
        timestamp: Date.now(),
      }));
      
      track(EVENTS.CHECKOUT_SESSION_CREATED, { 
        plan: selectedPlan,
        sessionId: result.sessionId,
        reused: result.reused || false,
      });
      
      // Transition to redirect
      stateMachine.transitionTo(SubscriptionState.CHECKOUT_REDIRECT);
      
      // Redirect to Stripe
      window.location.href = result.url;
      
    } catch (err) {
      console.error('Failed to create checkout session:', err);
      showToast('error', err.message || 'Failed to start checkout');
      track(EVENTS.CHECKOUT_SESSION_FAILED, { plan: selectedPlan, error: err.message });
      stateMachine.transitionTo(SubscriptionState.ERROR, { error: err.message });
    } finally {
      showLoading(false);
    }
  }

  // =============================================
  // UI Updates
  // =============================================

  function updateStatusDisplay() {
    if (!billingStatus) return;
    
    const { subscription, tokens } = billingStatus;
    
    statusBanner.classList.remove('hidden');
    
    const statusText = getStatusText(subscription.status);
    statusValue.textContent = statusText;
    statusValue.className = `status-value ${subscription.status}`;
    
    tokenValue.textContent = tokens.totalFormatted;
    
    showTrialBanner(subscription.canStartTrial && subscription.status === 'none');
    
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
    track(EVENTS.BILLING_PORTAL_OPENED);
    
    try {
      const result = await apiCall('/api/billing/portal-session', {
        method: 'POST',
      });
      
      window.location.href = result.url;
      
    } catch (err) {
      console.error('Failed to open billing portal:', err);
      showToast('error', err.message || 'Failed to open billing portal');
    } finally {
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
      track(EVENTS.PRICING_TOGGLE_CLICKED, { plan: 'monthly' });
    });
    
    yearlyToggle.addEventListener('click', () => {
      currentPlan = 'yearly';
      yearlyToggle.classList.add('active');
      monthlyToggle.classList.remove('active');
      updatePlanDisplay();
      track(EVENTS.PRICING_TOGGLE_CLICKED, { plan: 'yearly' });
    });
  }

  function updatePlanDisplay() {
    pricingCards.forEach(card => {
      const plan = card.dataset.plan;
      
      if (plan === currentPlan) {
        card.classList.add('featured');
      } else {
        card.classList.remove('featured');
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
      startTrialBtn.addEventListener('click', startTrial);
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

  function showErrorToast(message, retryCallback) {
    const toast = document.createElement('div');
    toast.className = 'toast error';
    
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.style.marginBottom = '0.5rem';
    toast.appendChild(messageDiv);
    
    if (retryCallback) {
      const retryBtn = document.createElement('button');
      retryBtn.textContent = 'Retry';
      retryBtn.className = 'toast-retry-btn';
      retryBtn.style.cssText = `
        background: white;
        color: #dc2626;
        border: none;
        padding: 0.25rem 0.75rem;
        border-radius: 4px;
        font-weight: 600;
        font-size: 0.875rem;
        cursor: pointer;
        margin-top: 0.5rem;
      `;
      retryBtn.onclick = () => {
        toast.remove();
        retryCallback();
      };
      toast.appendChild(retryBtn);
    }
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 8000); // Longer timeout for error with retry
  }

  async function getFingerprint() {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 'unknown',
    ];
    
    const text = components.join('|');
    
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return hash.toString(36);
  }

  // =============================================
  // URL Parameter Handling
  // =============================================

  function handleUrlParams() {
    const params = new URLSearchParams(window.location.search);
    
    if (params.has('session_id')) {
      // This will be handled by checkout-success.html
      showToast('success', 'Processing your subscription...');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    if (params.has('canceled')) {
      showToast('error', 'Checkout was canceled');
      track(EVENTS.CHECKOUT_CANCELED);
      sessionStorage.removeItem('subscription_pending');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  // =============================================
  // Initialize
  // =============================================

  if (window.i18n) {
    window.i18n.on('initialized', () => {
      init();
      handleUrlParams();
    });
    
    setTimeout(() => {
      init();
      handleUrlParams();
    }, 500);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      init();
      handleUrlParams();
    });
  }
})();

