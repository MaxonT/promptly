/**
 * GlobalStatusManager - Compact Floating Status Notification
 * 
 * Provides a persistent, non-intrusive status indicator that survives page navigation.
 * Uses sessionStorage to maintain state across pages.
 * 
 * Features:
 * - Compact floating notification (doesn't block navigation)
 * - Real-time elapsed time counter
 * - Mode-specific time estimates
 * - Success/error state with color coding
 * - Browser notification on completion
 * - Auto-hide on completion
 */

const GlobalStatusManager = (function() {
  // Private state
  const STORAGE_KEY = 'promptly:global-status';
  const MODE_ESTIMATES = {
    fast: { min: 10, max: 60 },
    deep: { min: 30, max: 120 },
    ultra: { min: 90, max: 180 }
  };

  let statusElement = null;
  let titleElement = null;
  let subtitleElement = null;
  let closeBtn = null;
  let elapsedInterval = null;
  let startTime = null;
  let currentMode = 'deep';
  let currentSessionId = null;
  let lastState = {};

  /**
   * Initialize the global status bar DOM
   */
  function init() {
    // Check if already initialized
    if (document.getElementById('globalStatusBar')) {
      statusElement = document.getElementById('globalStatusBar');
      _attachElements();
      _restoreState();
      return;
    }

    // Create compact floating status element
    statusElement = document.createElement('div');
    statusElement.id = 'globalStatusBar';
    statusElement.className = 'global-status-bar hidden';
    statusElement.setAttribute('role', 'status');
    statusElement.setAttribute('aria-live', 'polite');

    statusElement.innerHTML = `
      <div class="global-status-content">
        <div class="global-status-icon">
          <span class="global-status-spinner"></span>
        </div>
        <div class="global-status-text">
          <div class="global-status-title"></div>
          <div class="global-status-subtitle"></div>
        </div>
        <button class="global-status-close" aria-label="Dismiss status">&times;</button>
      </div>
    `;

    document.body.appendChild(statusElement);
    _attachElements();
    _restoreState();
    
    // Request notification permission if not granted
    _requestNotificationPermission();
  }

  /**
   * Request browser notification permission
   */
  function _requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  /**
   * Send browser notification
   */
  function _sendNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: body,
          icon: '/assets/promptly-icon.svg',
          tag: 'promptly-wizard',
          requireInteraction: false
        });
      } catch (e) {
        console.warn('[GlobalStatus] Notification failed:', e);
      }
    }
  }

  /**
   * Attach element references
   */
  function _getWizardUrl(sessionId) {
    const url = new URL('/wizard.html', window.location.origin);
    if (sessionId) {
      url.searchParams.set('sessionId', sessionId);
    }
    return url.toString();
  }

  function _attachElements() {
    titleElement = statusElement.querySelector('.global-status-title');
    subtitleElement = statusElement.querySelector('.global-status-subtitle');
    closeBtn = statusElement.querySelector('.global-status-close');

    statusElement?.setAttribute('role', 'button');
    statusElement?.setAttribute('tabindex', '0');
    statusElement?.setAttribute('aria-label', 'Return to active Question Wizard');

    closeBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      hide();
    });

    const handleActivate = () => {
      const sessionId = currentSessionId || window.promptlyWizardSession?.getActive?.()?.sessionId;
      window.location.assign(_getWizardUrl(sessionId));
    };

    statusElement?.addEventListener('click', handleActivate);
    statusElement?.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' || evt.key === ' ' || evt.key === 'Spacebar') {
        evt.preventDefault();
        handleActivate();
      }
    });
  }

  /**
   * Restore state from sessionStorage
   */
  function _restoreState() {
    const savedState = sessionStorage.getItem(STORAGE_KEY);
    if (!savedState) return;

    try {
      const state = JSON.parse(savedState);
      
      // Check if the status is still relevant (not too old)
      const elapsed = Date.now() - state.startTime;
      const maxAge = 10 * 60 * 1000; // 10 minutes max

      if (elapsed > maxAge) {
        _clearState();
        return;
      }

      // Restore the status
      if (state.visible) {
        startTime = state.startTime;
        currentMode = state.mode || 'deep';
        currentSessionId = state.sessionId || null;
        show({
          title: state.title,
          subtitle: state.subtitle,
          mode: state.mode,
          state: state.state,
          sessionId: state.sessionId
        });
      }
    } catch (e) {
      console.warn('[GlobalStatus] Failed to restore state:', e);
      _clearState();
    }
  }

  /**
   * Save state to sessionStorage
   */
  function _saveState(state) {
    lastState = {
      ...lastState,
      ...state,
      startTime: startTime,
      mode: currentMode,
      visible: true,
      sessionId: currentSessionId,
      timestamp: Date.now()
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(lastState));
  }

  /**
   * Clear saved state
   */
  function _clearState() {
    sessionStorage.removeItem(STORAGE_KEY);
    lastState = {};
  }

  /**
   * Start elapsed time counter with real-time updates
   */
  function _startElapsedCounter() {
    if (elapsedInterval) clearInterval(elapsedInterval);
    
    elapsedInterval = setInterval(() => {
      if (!startTime || !subtitleElement) return;
      
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const estimate = MODE_ESTIMATES[currentMode] || MODE_ESTIMATES.deep;
      
      // Calculate dynamic progress estimate
      const avgEstimate = (estimate.min + estimate.max) / 2;
      const progressPercent = Math.min(95, Math.round((elapsed / avgEstimate) * 100));
      
      // Real-time subtitle with elapsed and remaining estimate
      let statusText = `${elapsed}s elapsed`;
      if (elapsed < estimate.max) {
        const remaining = Math.max(0, Math.round(avgEstimate - elapsed));
        if (remaining > 0) {
          statusText += ` • ~${remaining}s remaining`;
        }
      } else {
        statusText += ' • Taking longer than usual';
      }
      
      subtitleElement.textContent = statusText;
    }, 1000);
  }

  /**
   * Stop elapsed time counter
   */
  function _stopElapsedCounter() {
    if (elapsedInterval) {
      clearInterval(elapsedInterval);
      elapsedInterval = null;
    }
  }

  /**
   * Show the global status bar
   * @param {Object} options - Display options
   */
  function show(options = {}) {
    if (!statusElement) init();

    const {
      title = '🧙‍♂️ Wizard Running',
      subtitle = 'Processing...',
      mode = 'deep',
      state = 'loading', // loading, success, error
      sessionId
    } = options;

    currentMode = mode;

    // Set start time if new
    if (!startTime) {
      startTime = Date.now();
    }

    if (sessionId) {
      currentSessionId = sessionId;
    }

    // Update content
    if (titleElement) titleElement.textContent = title;
    
    if (subtitleElement) {
      subtitleElement.textContent = subtitle;
    }

    // Set state class
    statusElement.classList.remove('hidden', 'global-status--success', 'global-status--error');
    if (state === 'success') {
      statusElement.classList.add('global-status--success');
    } else if (state === 'error') {
      statusElement.classList.add('global-status--error');
    }

    // Start elapsed counter for loading state
    if (state === 'loading') {
      _startElapsedCounter();
    }

    // Save state for persistence across pages
    _saveState({ title, subtitle, mode, state });
  }

  /**
   * Update progress (kept for compatibility but simplified)
   * @param {number} percent - Progress percentage (0-100)
   */
  function updateProgress(percent) {
    // Progress is now calculated dynamically based on elapsed time
    // This method is kept for API compatibility
  }

  /**
   * Mark status as complete
   * @param {Object} options - Completion options
   */
  function complete(options = {}) {
    const {
      message = '✅ Complete!',
      autoHide = true,
      autoHideDelay = 4000,
      notify = true,
      sessionId
    } = options;

    _stopElapsedCounter();

    if (sessionId) {
      currentSessionId = sessionId;
    }

    if (statusElement) {
      statusElement.classList.remove('global-status--error');
      statusElement.classList.add('global-status--success');
    }

    if (titleElement) titleElement.textContent = message;
    
    // Show total elapsed time
    if (subtitleElement && startTime) {
      const totalElapsed = Math.floor((Date.now() - startTime) / 1000);
      subtitleElement.textContent = `Completed in ${totalElapsed}s`;
    }

    // Send browser notification if page is not visible
    if (notify && document.hidden) {
      _sendNotification('Promptly Wizard Complete', message);
    }

    // Auto-hide after delay
    if (autoHide) {
      setTimeout(() => {
        hide();
      }, autoHideDelay);
    }
  }

  /**
   * Mark status as error
   * @param {Object} options - Error options
   */
  function error(options = {}) {
    const {
      message = '❌ Error',
      details = '',
      autoHide = false,
      notify = true,
      sessionId
    } = options;

    _stopElapsedCounter();

    if (sessionId) {
      currentSessionId = sessionId;
    }

    if (statusElement) {
      statusElement.classList.remove('global-status--success');
      statusElement.classList.add('global-status--error');
    }

    if (titleElement) titleElement.textContent = message;
    if (subtitleElement) subtitleElement.textContent = details;

    // Send browser notification if page is not visible
    if (notify && document.hidden) {
      _sendNotification('Promptly Wizard Error', details || message);
    }

    // Save error state
    _saveState({ title: message, subtitle: details, state: 'error' });

    // Auto-hide if requested
    if (autoHide) {
      setTimeout(() => {
        hide();
      }, 5000);
    }
  }

  /**
   * Hide the status bar
   */
  function hide() {
    _stopElapsedCounter();
    startTime = null;
    currentSessionId = null;

    if (statusElement) {
      statusElement.classList.add('hidden');
    }

    _clearState();
  }

  /**
   * Associate a session id with the status bar (for navigation/restoration)
   * @param {string} sessionId
   */
  function setSession(sessionId) {
    if (!sessionId) return;
    currentSessionId = sessionId;

    // Persist the session id alongside the last known state
    if (Object.keys(lastState).length > 0) {
      _saveState({});
    } else {
      _saveState({ sessionId });
    }
  }

  /**
   * Check if status is currently visible
   * @returns {boolean}
   */
  function isVisible() {
    return statusElement && !statusElement.classList.contains('hidden');
  }

  // Public API
  return {
    init,
    show,
    hide,
    updateProgress,
    complete,
    error,
    setSession,
    isVisible
  };
})();

// Auto-initialize on DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', GlobalStatusManager.init);
  } else {
    GlobalStatusManager.init();
  }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GlobalStatusManager };
}
if (typeof window !== 'undefined') {
  window.globalStatus = GlobalStatusManager;
}
