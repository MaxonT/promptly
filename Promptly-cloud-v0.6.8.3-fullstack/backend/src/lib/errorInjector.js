/**
 * Error Injection for Testing
 * 
 * Enable via: ENABLE_ERROR_INJECTION=1 in .env
 * Control via: /api/debug/inject-error endpoint (dev only)
 */

const ENABLE_INJECTION = process.env.ENABLE_ERROR_INJECTION === '1';

let injectionConfig = {
  network_delay_ms: 0,              // 模拟网络延迟
  fail_checkout_creation: false,    // 模拟checkout创建失败
  fail_webhook_processing: false,   // 模拟webhook处理失败
  fail_session_verification: false, // 模拟session验证失败
  stripe_api_error: null,           // 'card_declined', 'rate_limit', etc.
};

export function isInjectionEnabled() {
  return ENABLE_INJECTION;
}

export function shouldInjectError(errorType) {
  if (!ENABLE_INJECTION) return false;
  return injectionConfig[errorType] === true;
}

export async function injectDelay() {
  if (!ENABLE_INJECTION || !injectionConfig.network_delay_ms) return;
  await new Promise(r => setTimeout(r, injectionConfig.network_delay_ms));
}

export function setInjectionConfig(config) {
  if (!ENABLE_INJECTION) {
    console.warn('[errorInjector] Error injection is disabled');
    return false;
  }
  injectionConfig = { ...injectionConfig, ...config };
  console.log('[errorInjector] Config updated:', injectionConfig);
  return true;
}

export function getInjectionConfig() {
  return ENABLE_INJECTION ? injectionConfig : null;
}

export function resetInjectionConfig() {
  injectionConfig = {
    network_delay_ms: 0,
    fail_checkout_creation: false,
    fail_webhook_processing: false,
    fail_session_verification: false,
    stripe_api_error: null,
  };
}

export class InjectedError extends Error {
  constructor(message, type) {
    super(message);
    this.name = 'InjectedError';
    this.injectedType = type;
  }
}
