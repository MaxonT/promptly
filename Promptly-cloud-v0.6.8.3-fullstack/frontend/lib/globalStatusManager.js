/**
 * GlobalStatusManager - Cross-Page Status Bar System
 * 
 * Provides a persistent status indicator that survives page navigation.
 * Uses sessionStorage to maintain state across pages.
 * 
 * Features:
 * - Fixed position status bar at top of viewport
 * - Real-time progress bar with percentage
 * - Elapsed time counter
 * - Mode-specific time estimates
 * - Success/error state with color coding
 * - Auto-hide on completion
 * - Animated slide-in/out transitions
 */

const GlobalStatusManager = (function() {
  // Private state
  const STORAGE_KEY = 'promptly:global-status';
  const MODE_ESTIMATES = {
    fast: { min: 10, max: 40 },
    deep: { min: 30, max: 90 },
    ultra: { min: 90, max: 180 }
  };

  let statusElement = null;
  let progressElement = null;
  let titleElement = null;
  let subtitleElement = null;
  let closeBtn = null;
  let elapsedInterval = null;
  let startTime = null;

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

    // Create status bar element
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
        <div class="global-status-progress">
          <div class="global-status-progress-bar"></div>
          <span class="global-status-progress-text">0%</span>
        </div>
        <button class="global-status-close" aria-label="Dismiss status">&times;</button>
      </div>
    `;

    document.body.insertBefore(statusElement, document.body.firstChild);
    _attachElements();
    _restoreState();
  }

  /**
   * Attach element references
   */
  function _attachElements() {
    titleElement = statusElement.querySelector('.global-status-title');
    subtitleElement = statusElement.querySelector('.global-status-subtitle');
    progressElement = statusElement.querySelector('.global-status-progress-bar');
    closeBtn = statusElement.querySelector('.global-status-close');

    closeBtn?.addEventListener('click', hide);
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
      const maxAge = 5 * 60 * 1000; // 5 minutes max

      if (elapsed > maxAge) {
        _clearState();
        return;
      }

      // Restore the status
      if (state.visible) {
        startTime = state.startTime;
        show({
          title: state.title,
          subtitle: state.subtitle,
          progress: state.progress,
          mode: state.mode,
          estimatedTime: state.estimatedTime,
          state: state.state
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
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...state,
      startTime: startTime,
      visible: true,
      timestamp: Date.now()
    }));
  }

  /**
   * Clear saved state
   */
  function _clearState() {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Start elapsed time counter
   */
  function _startElapsedCounter() {
    if (elapsedInterval) clearInterval(elapsedInterval);
    
    elapsedInterval = setInterval(() => {
      if (!startTime || !subtitleElement) return;
      
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const currentSubtitle = subtitleElement.dataset.baseText || '';
      
      // Update with elapsed time
      const elapsedText = `(${elapsed}s elapsed)`;
      subtitleElement.textContent = `${currentSubtitle} ${elapsedText}`;
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
   * Format time estimate based on mode
   */
  function _formatEstimate(mode) {
    const estimate = MODE_ESTIMATES[mode] || MODE_ESTIMATES.deep;
    return `Usually ${estimate.min}–${estimate.max}s`;
  }

  /**
   * Show the global status bar
   * @param {Object} options - Display options
   */
  function show(options = {}) {
    if (!statusElement) init();

    const {
      title = '🧙‍♂️ Processing...',
      subtitle = 'Please wait...',
      progress = 0,
      mode = 'deep',
      estimatedTime = false,
      state = 'loading' // loading, success, error
    } = options;

    // Set start time if new
    if (!startTime) {
      startTime = Date.now();
    }

    // Update content
    if (titleElement) titleElement.textContent = title;
    
    if (subtitleElement) {
      let displaySubtitle = subtitle;
      if (estimatedTime) {
        displaySubtitle = `${subtitle} ${_formatEstimate(mode)}`;
      }
      subtitleElement.dataset.baseText = displaySubtitle;
      subtitleElement.textContent = displaySubtitle;
    }

    // Update progress
    updateProgress(progress);

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
    _saveState({ title, subtitle, progress, mode, estimatedTime, state });
  }

  /**
   * Update progress percentage
   * @param {number} percent - Progress percentage (0-100)
   */
  function updateProgress(percent) {
    if (!statusElement) return;

    const progressBar = statusElement.querySelector('.global-status-progress-bar');
    const progressText = statusElement.querySelector('.global-status-progress-text');

    if (progressBar) {
      progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
    if (progressText) {
      progressText.textContent = `${Math.round(percent)}%`;
    }

    // Update saved state
    const savedState = sessionStorage.getItem(STORAGE_KEY);
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        state.progress = percent;
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        // Ignore
      }
    }
  }

  /**
   * Mark status as complete
   * @param {Object} options - Completion options
   */
  function complete(options = {}) {
    const {
      message = '✅ Complete!',
      autoHide = true,
      autoHideDelay = 3000
    } = options;

    _stopElapsedCounter();

    if (statusElement) {
      statusElement.classList.remove('global-status--error');
      statusElement.classList.add('global-status--success');
    }

    if (titleElement) titleElement.textContent = message;
    if (subtitleElement) subtitleElement.textContent = '';
    
    updateProgress(100);

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
      autoHide = false
    } = options;

    _stopElapsedCounter();

    if (statusElement) {
      statusElement.classList.remove('global-status--success');
      statusElement.classList.add('global-status--error');
    }

    if (titleElement) titleElement.textContent = message;
    if (subtitleElement) subtitleElement.textContent = details;

    // Save error state
    _saveState({ title: message, subtitle: details, progress: 0, state: 'error' });

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

    if (statusElement) {
      statusElement.classList.add('hidden');
    }

    _clearState();
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
