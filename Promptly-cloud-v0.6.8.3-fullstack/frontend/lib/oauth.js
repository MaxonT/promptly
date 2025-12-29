/**
 * OAuth Authentication Handler
 * Handles Google and GitHub OAuth flows using PKCE
 */

(function() {
  const API_BASE = (window.PROMPTLY_API_BASE && window.PROMPTLY_API_BASE.trim()) || 
    (window.location && window.location.origin && window.location.origin !== "null" 
      ? window.location.origin 
      : "http://localhost:8080");

  const TOKEN_KEY = "promptly.token";

  // =============================================
  // OAuth Flow
  // =============================================

  async function initiateOAuth(provider) {
    try {
      console.log(`[oauth] Initiating ${provider} OAuth flow...`);
      console.log(`[oauth] API_BASE: ${API_BASE}`);
      
      const response = await fetch(`${API_BASE}/api/auth/oauth/${provider}/authorize`);
      console.log(`[oauth] Response status: ${response.status}`);
      
      const data = await response.json();
      console.log(`[oauth] Response data:`, data);

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to initiate OAuth');
      }

      // Store state for verification on callback
      sessionStorage.setItem(`oauth_state_${provider}`, data.state);

      // Redirect to OAuth provider
      console.log(`[oauth] Redirecting to: ${data.authUrl}`);
      window.location.href = data.authUrl;
    } catch (err) {
      console.error(`[oauth] Failed to initiate ${provider} OAuth:`, err);
      showError(err.message || `Failed to start ${provider} authentication`);
    }
  }

  // =============================================
  // OAuth Callback Handler
  // =============================================

  function handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('oauth_token');
    const success = urlParams.get('oauth_success');
    const error = urlParams.get('oauth_error');

    if (error) {
      showError(decodeURIComponent(error));
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (success === 'true' && token) {
      // Save token
      localStorage.setItem(TOKEN_KEY, token);
      
      // Dispatch auth state change event
      window.dispatchEvent(new CustomEvent('authStateChanged'));
      
      // Show success message
      showSuccess('Successfully signed in!');
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Refresh auth status if available
      if (window.authStatus && window.authStatus.checkAuthStatus) {
        window.authStatus.checkAuthStatus();
      }
    }
  }

  // =============================================
  // UI Helpers
  // =============================================

  function showError(message) {
    // Try to use toast if available
    if (window.showToast) {
      window.showToast('error', message);
    } else {
      alert(message);
    }
  }

  function showSuccess(message) {
    // Try to use toast if available
    if (window.showToast) {
      window.showToast('success', message);
    } else {
      console.log('[oauth]', message);
    }
  }

  // =============================================
  // Public API
  // =============================================

  window.oauth = {
    signInWithGoogle: () => initiateOAuth('google'),
    signInWithGitHub: () => initiateOAuth('github'),
    handleCallback: handleOAuthCallback
  };

  // Auto-handle callback on page load
  if (window.location.search.includes('oauth_token') || window.location.search.includes('oauth_error')) {
    handleOAuthCallback();
  }
})();

