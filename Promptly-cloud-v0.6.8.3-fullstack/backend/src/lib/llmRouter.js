import { chatJson as chatJsonOpenAI, chatText as chatTextOpenAI, LlmDisabledError, getResolvedDefaultModel, isLlmEnabled } from "./openaiClient.js";
import { chatJsonGroq, chatTextGroq } from "./groqClient.js";
import { chatJsonAnthropic, chatTextAnthropic } from "./anthropicClient.js";

export { LlmDisabledError, getResolvedDefaultModel, isLlmEnabled };

/**
 * Route LLM calls to the appropriate provider
 *
 * This is the SINGLE SOURCE OF TRUTH for provider dispatching.
 * No client should know about other clients.
 */

// =============================================
// Problem B1: Exponential Backoff Retry Wrapper
// 对 429 / 5xx / 网络错误进行指数退避重试
// =============================================

/** HTTP 状态码：可重试的临时性错误 */
const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);

/** 可重试的网络错误码 */
const RETRYABLE_ERROR_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNABORTED']);

/** 最大重试次数（不含首次调用） */
const LLM_MAX_RETRY_ATTEMPTS = 3;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 对 LLM API 调用进行指数退避重试
 * 重试间隔：1s → 2s → 4s
 * 仅对临时性错误（429/5xx/网络错误）重试，业务错误（400/401/403）直接抛出
 *
 * @param {Function} fn - 要执行的异步函数
 * @param {string} context - 日志上下文标识（如 'chatJson/openai'）
 */
async function withRetry(fn, context) {
  let lastError;
  for (let attempt = 0; attempt < LLM_MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // LlmDisabledError 直接抛出，不重试
      if (err instanceof LlmDisabledError) throw err;

      const status = err.status || err.statusCode;
      const isRetryableStatus = status && RETRYABLE_STATUS_CODES.has(status);
      const isRetryableNetwork = RETRYABLE_ERROR_CODES.has(err.code);

      if (!isRetryableStatus && !isRetryableNetwork) {
        // 不可重试的错误（如 400 参数错误、401 认证失败），直接抛出
        throw err;
      }

      const isLastAttempt = attempt === LLM_MAX_RETRY_ATTEMPTS - 1;
      if (isLastAttempt) break;

      // 指数退避：1000ms, 2000ms, 4000ms
      const delayMs = Math.pow(2, attempt) * 1000;
      console.warn(
        `[llmRouter] ⚠️  ${context} failed (status=${status || err.code}), ` +
        `retrying in ${delayMs}ms (attempt ${attempt + 1}/${LLM_MAX_RETRY_ATTEMPTS - 1})…`
      );
      await sleep(delayMs);
    }
  }
  throw lastError;
}

/**
 * Standardized JSON Chat Completion
 */
export async function chatJson({ system, user, model, promptlyModelId, provider, apiKey, maxTokens, temperature }) {
  if (!provider) {
    throw new Error(`[llmRouter] ❌ Contract Violation: 'provider' MUST be explicitly set. Received: ${provider}`);
  }
  if (provider === 'groq') {
    return withRetry(
      () => chatJsonGroq({ system, user, model, apiKey, maxTokens, temperature }),
      'chatJson/groq'
    );
  } else if (provider === 'openai') {
    return withRetry(
      () => chatJsonOpenAI({ system, user, model, promptlyModelId, apiKey, maxTokens, temperature }),
      'chatJson/openai'
    );
  } else if (provider === 'anthropic') {
    return withRetry(
      () => chatJsonAnthropic({ system, user, model, apiKey, maxTokens, temperature }),
      'chatJson/anthropic'
    );
  } else {
    throw new Error(`[llmRouter] ❌ Contract Violation: Unknown provider '${provider}'. Supported: 'openai', 'groq', 'anthropic'`);
  }
}

/**
 * Standardized Text Chat Completion
 */
export async function chatText({ system, user, model, promptlyModelId, provider, temperature, forceRewritePrompt, minSimilarity, maxRetries }) {
  if (!provider) {
    throw new Error(`[llmRouter] ❌ Contract Violation: 'provider' MUST be explicitly set. Received: ${provider}`);
  }
  if (provider === 'groq') {
    // Token Hardening: Groq returns similarity=0, which will skip similarity gate in openaiClient
    // This prevents unnecessary retries for Groq provider (0 < any threshold, so no retry triggered)
    return withRetry(
      () => chatTextGroq({ system, user, model, temperature, minSimilarity, maxRetries }),
      'chatText/groq'
    );
  } else if (provider === 'openai') {
    return withRetry(
      () => chatTextOpenAI({ system, user, model, promptlyModelId, temperature, forceRewritePrompt, minSimilarity, maxRetries }),
      'chatText/openai'
    );
  } else if (provider === 'anthropic') {
    return withRetry(
      () => chatTextAnthropic({ system, user, model, temperature, minSimilarity, maxRetries }),
      'chatText/anthropic'
    );
  } else {
    throw new Error(`[llmRouter] ❌ Contract Violation: Unknown provider '${provider}'. Supported: 'openai', 'groq', 'anthropic'`);
  }
}
