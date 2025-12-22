/**
 * PROMPT OPTIMIZATION PROCESS - Enhance Routes
 * 
 * 此模块实现了 Promptly 的 enhancer 优化流程，确保用户理解从输入到最终清理后的 prompt 之间发生的过程。
 * 
 * ============================================
 * IMPORTANT: Relationship with Best Prompt Pipeline
 * ============================================
 * 
 * This module (`/api/enhance/*`) provides **single-shot enhancement interfaces** for quick, 
 * one-off prompt improvements. These endpoints are useful for immediate enhancements without 
 * going through the full pipeline.
 * 
 * The **Best Prompt Pipeline** (implemented in `/api/prompts/*`, `/api/specs/from-idea`, etc.)
 * provides the complete, multi-stage pipeline:
 * - Spec Builder → Question Engine → LLM Agents → Metrics & Scoring → Outcome Runner
 * 
 * **Key Differences:**
 * - `/api/enhance/*` = Single LLM call, single result, immediate enhancement
 * - Best Prompt Pipeline = Multiple agents, multiple candidates, scoring, best-of-N selection
 * 
 * Both can coexist, serving different use cases:
 * - Use `/api/enhance/*` for quick enhancements
 * - Use Best Prompt Pipeline for comprehensive optimization with scoring
 * 
 * ============================================
 * PROMPT OPTIMIZATION PROCESS (6 Layers)
 * ============================================
 * 
 * 1) Input Layer (结构化输入)
 *    - 用户意图提取：收集原始 prompt，允许附加文件元数据
 *    - 文件清洗：后端对文件名进行安全清洗以避免注入
 *    - 反向澄清钩子：当缺少 prompt 时直接返回 400
 *    - 结构化输入：附件被封装为 [ATTACHMENT_METADATA] 块
 * 
 * 2) Spec Layer (规格封装) - Note: This is "Agent Policy Layer", not "Spec Builder"
 *    - 核心构件：后端在调用 LLM 之前组合包含背景与约束的 system prompt
 *    - 标准化：文件类别与尺寸统一格式化
 *    - 版本稳定性：增强模板是固定文案，确保多次调用保持一致行为
 *    - 强调"清晰、分段、易懂、利于模型解析"
 *    - Note: The "Spec Builder" (raw idea → structured spec) is in `/api/specs/from-idea`
 * 
 * 3) Compiler Layer (Prompt 生成)
 *    - 分块生成：用户正文 + [ATTACHMENT_METADATA_START/END] 作为输入块
 *    - system 块定义角色与输出要求
 *    - 最终构成对 LLM 的调用载荷
 *    - 模板化：增强提示使用确定性描述，避免随机指令漂移
 *    - 安全补全：对缺失或异常字段提供默认安全值
 * 
 * 4) Test Layer (稳定性验证)
 *    - 格式自检：检查 prompt 是否存在、类型是否正确
 *    - 行为校验：温度为默认低随机度配置（0.2），追求一致输出
 *    - 错误路径集中处理，确保异常返回 JSON 而非崩溃
 *    - 边界案例：无附件、多附件、异常文件名均被标准化
 * 
 * 5) Iteration Layer (迭代修复)
 *    - 错误捕获：handleEnhanceError 统一捕获并报告 LLM 停用、内部错误等场景
 *    - 返回稳定的错误结构
 *    - 体验反馈：前端横幅和按钮禁用提示 LLM 状态
 * 
 * 6) Outcome Layer (结果交付)
 *    - 最终输出：响应只包含增强后的 prompt 及处理的附件数量
 *    - 可解释性：日志打印附件摘要，帮助诊断输入与输出的关系
 * 
 * ============================================
 * LLM 在此流程中起重大作用！
 * ============================================
 * - 所有增强操作都通过 LLM 调用实现（chatText/chatJson）
 * - System prompt 精心设计以指导 LLM 进行优化
 * - 温度配置为 0.2 以确保一致性和确定性
 * - 每个端点都有独立的 system prompt 针对特定优化目标
 * 
 * Current implementation:
 * - Accepts JSON requests with prompt text and optional attachments array
 * - Attachments include: name, size, type, dataURL (base64)
 * - Generates text descriptions of attachments for LLM context
 * - Does not yet parse file contents or use vision models
 * 
 * Future extensions:
 * - Phase 2: Extract text from PDFs, OCR from images
 * - Phase 3: Use GPT-4V or Claude Vision for image analysis
 * - Phase 4: Integrate cloud storage (S3) for large files
 */

import express from "express";
import { chatJson, chatText, LlmDisabledError } from "../lib/openaiClient.js";

const enhanceRouter = express.Router();

/**
 * ATTACHMENT FEATURE - Helper Functions
 */

// Get human-readable category from MIME type
function getAttachmentCategory(mimeType) {
  if (!mimeType) return 'FILE';
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('text')) return 'TEXT';
  if (mimeType.includes('json')) return 'JSON';
  if (mimeType.includes('xml')) return 'XML';
  return 'FILE';
}

// Format file size for display
function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Maximum allowed length for sanitized attachment names
const MAX_FILENAME_LENGTH = 100;
// Maximum expected file extension length (e.g., .docx, .jpeg, .html)
const MAX_EXTENSION_LENGTH = 10;
// Fallback MIME type when not provided
const DEFAULT_MIME_TYPE = 'application/octet-stream';

/**
 * Input Layer: 用户意图提取 - 文件名安全清洗
 * 后端对文件名进行安全清洗以避免注入，并将类型与大小标准化
 * 
 * - Removes or escapes special characters that could be used for prompt injection
 * - Limits filename length to prevent overly long inputs
 * - Preserves readability while ensuring safety
 */
function sanitizeAttachmentName(name) {
  if (!name || typeof name !== 'string') {
    return 'unnamed_file';
  }
  
  // Remove control characters, null bytes, and extended control characters (C0, DEL, C1)
  let sanitized = name.replace(/[\x00-\x1f\x7f\x80-\x9f]/g, '');
  
  // Replace characters that could be used for prompt injection or confusion
  // This includes: backticks, brackets, pipes, angle brackets, and parentheses
  sanitized = sanitized
    .replace(/[`[\]{}|<>()]/g, '_')
    .replace(/---+/g, '-')  // Prevent delimiter-like sequences
    .replace(/\.\.\./g, '.')  // Collapse ellipsis
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .trim();
  
  // Truncate to maximum length, preserving file extension if possible
  if (sanitized.length > MAX_FILENAME_LENGTH) {
    const lastDot = sanitized.lastIndexOf('.');
    // Check if extension exists and is within expected length
    if (lastDot > 0 && lastDot > sanitized.length - MAX_EXTENSION_LENGTH) {
      // Preserve extension
      const ext = sanitized.substring(lastDot);
      const baseName = sanitized.substring(0, MAX_FILENAME_LENGTH - ext.length - 3);
      sanitized = baseName + '...' + ext;
    } else {
      sanitized = sanitized.substring(0, MAX_FILENAME_LENGTH - 3) + '...';
    }
  }
  
  return sanitized || 'unnamed_file';
}

function normalizeAttachment(att) {
  if (!att || typeof att !== 'object') {
    return { name: 'unnamed_file', size: 0, type: DEFAULT_MIME_TYPE };
  }

  const name = sanitizeAttachmentName(att.name);
  const size = Number.isFinite(att.size) && att.size > 0 ? att.size : 0;
  const type = typeof att.type === 'string' ? att.type : DEFAULT_MIME_TYPE;

  return { name, size, type };
}

function coerceAttachments(attachments) {
  return Array.isArray(attachments) ? attachments : [];
}

/**
 * Compiler Layer: Prompt 生成 - 结构化输入
 * 附件被封装为 [ATTACHMENT_METADATA] 块，确保额外上下文与用户正文分隔
 * 
 * Current: Generates text descriptions of attached files
 * Security: Sanitizes filenames to prevent prompt injection
 * Future: 
 *   - For images: Use vision API to analyze content
 *   - For PDFs: Extract and include text content
 *   - For videos: Extract keyframes and captions
 */
function buildAttachmentContext(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return "";
  }

  const descriptions = attachments.map((att, i) => {
    const safeAttachment = normalizeAttachment(att);
    const category = getAttachmentCategory(safeAttachment.type);
    const size = formatSize(safeAttachment.size);
    const sanitizedName = safeAttachment.name;
    return `  ${i + 1}. [${category}] "${sanitizedName}" (${size})`;
  });

  // Compiler Layer: 使用清晰、独特的边界，避免与用户内容或系统指令混淆
  // 结构化输入：附件被封装为 [ATTACHMENT_METADATA_START/END] 块
  return "\n\n[ATTACHMENT_METADATA_START]\n" +
    "The following is a list of attached files (metadata only, contents not parsed):\n" +
    descriptions.join("\n") +
    "\n[ATTACHMENT_METADATA_END]";
}

/**
 * Log attachment metadata (for debugging and future analytics)
 */
function logAttachments(attachments, endpoint) {
  if (!Array.isArray(attachments) || attachments.length === 0) return;

  console.log(`[promptly] Attachments received at ${endpoint}:`);
  attachments.forEach((att, i) => {
    const safeAttachment = normalizeAttachment(att);
    const category = getAttachmentCategory(safeAttachment.type);
    const size = formatSize(safeAttachment.size);
    const sanitizedName = safeAttachment.name;
    console.log(`  ${i + 1}. ${sanitizedName} - ${category} - ${size}`);
  });
}

/**
 * Log model usage for analytics and debugging
 * @param {string} endpoint - The API endpoint
 * @param {string} model - The model used
 * @param {string} completionId - The completion ID from OpenAI
 */
function logModelUsage(endpoint, model, completionId) {
  if (model && completionId) {
    console.log(`[promptly] ${endpoint} - Model: ${model}, Completion ID: ${completionId}`);
  }
}

function handleEnhanceError(res, endpoint, err, defaultMessage) {
  console.error(`[promptly] ${endpoint} error:`, err);

  if (err instanceof LlmDisabledError || err.code === "LLM_DISABLED") {
    return res.status(503).json({
      ok: false,
      error: "LLM disabled: set OPENAI_API_KEY to enable enhancement"
    });
  }

  return res.status(500).json({
    ok: false,
    error: err.message || defaultMessage
  });
}

/**
 * POST /api/enhance/structure
 * Enhance prompt with structural improvements
 * 
 * PROMPT OPTIMIZATION PROCESS:
 * 1) Input Layer - 结构化输入：收集原始 prompt，文件元数据清洗
 * 2) Spec Layer - 规格封装：组合 system prompt，强调"清晰、分段、易懂、利于模型解析"
 * 3) Compiler Layer - Prompt 生成：用户正文 + ATTACHMENT_METADATA 作为输入块
 * 4) Test Layer - 稳定性验证：格式自检，温度配置
 * 5) Iteration Layer - 迭代修复：错误捕获
 * 6) Outcome Layer - 结果交付：返回增强后的 prompt
 */
enhanceRouter.post("/structure", async (req, res) => {
  try {
    console.log(`[promptly] 📝 /enhance/structure: Request received`);
    
    // 1) Input Layer: 结构化输入 - 收集原始 prompt 和附件
    const { prompt, attachments = [] } = req.body;
    const safeAttachments = coerceAttachments(attachments);

    // Input Layer: 反向澄清钩子 - 当缺少 prompt 时直接返回 400
    if (!prompt || typeof prompt !== 'string') {
      console.warn(`[promptly] ⚠️  /enhance/structure: Missing or invalid prompt field`);
      return res.status(400).json({
        ok: false,
        error: "Missing or invalid 'prompt' field"
      });
    }

    console.log(`[promptly] Prompt length: ${prompt.length} chars, Attachments: ${safeAttachments.length}`);

    // Input Layer: 日志打印附件摘要，帮助诊断
    logAttachments(safeAttachments, "/structure");

    // 3) Compiler Layer: Prompt 生成 - 用户正文 + ATTACHMENT_METADATA 块
    const attachmentContext = buildAttachmentContext(safeAttachments);
    const fullPrompt = prompt + attachmentContext;

    console.log(`[promptly] Full prompt length (with attachments): ${fullPrompt.length} chars`);

    // Optimized: Concise system prompt to reduce token usage
    const system = `Restructure prompt with clear sections, headings, and formatting.

CRITICAL: Output MUST differ from input. Add structure, headings (#, ##), bullet points, and explicit instructions.

Output: Enhanced prompt only.`;

    console.log(`[promptly] 🔄 About to call LLM (chatText) for structure enhancement...`);

    // 4) Test Layer: 稳定性验证 - LLM 调用
    // Optimization: Use temp 0.5 to encourage divergence in the first shot, reducing the need for retries.
    // We KEEP the retry mechanism (maxRetries: 1) as a safety net, but it should trigger less often.
    const { text: enhanced, model: modelUsed, completionId, similarity } = await chatText({ 
      system, 
      user: fullPrompt,
      temperature: 0.5,     // Increased from default 0.2 to reduce retry probability
      minSimilarity: 0.85,  // Keep quality check
      maxRetries: 1         // Keep safety net
    });
    
    console.log(`[promptly] ✅ Received enhanced prompt from LLM, length: ${enhanced?.length || 0} chars`);
    
    // 4) Test Layer: 行为校验 - 记录模型使用情况
    logModelUsage("/enhance/structure", modelUsed, completionId);

    // 6) Outcome Layer: 结果交付 - 最终输出只包含增强后的 prompt 及处理的附件数量
    res.json({
      ok: true,
      result: {
        enhanced,
        attachmentsProcessed: safeAttachments.length
      }
    });

    console.log(`[promptly] ✅ /enhance/structure: Request completed successfully`);

  } catch (err) {
    console.error(`[promptly] ❌ /enhance/structure error:`, err.message || err);
    // 5) Iteration Layer: 迭代修复 - 错误捕获，统一处理 LLM 停用、内部错误等场景
    return handleEnhanceError(res, "/enhance/structure", err, "Enhancement failed");
  }
});

/**
 * POST /api/enhance/style
 * Enhance prompt with style and tone improvements
 */
enhanceRouter.post("/style", async (req, res) => {
  try {
    const { prompt, attachments = [] } = req.body;
    const safeAttachments = coerceAttachments(attachments);

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        ok: false,
        error: "Missing or invalid 'prompt' field"
      });
    }

    logAttachments(safeAttachments, "/style");

    const attachmentContext = buildAttachmentContext(safeAttachments);
    const fullPrompt = prompt + attachmentContext;

    // Optimized: Concise system prompt
    const system = `Improve prompt style, tone, and readability.

CRITICAL: Output MUST differ from input. Refine language, sentence structure, and flow.

Output: Enhanced prompt only.`;

    // Optimization: Use temp 0.5 to encourage divergence in the first shot
    const { text: enhanced, model: modelUsed, completionId, similarity } = await chatText({ 
      system, 
      user: fullPrompt,
      temperature: 0.5,     // Increased from default 0.2
      minSimilarity: 0.85,
      maxRetries: 1
    });
    logModelUsage("/enhance/style", modelUsed, completionId);

    res.json({
      ok: true,
      result: {
        enhanced,
        attachmentsProcessed: safeAttachments.length
      }
    });

  } catch (err) {
    return handleEnhanceError(res, "/enhance/style", err, "Enhancement failed");
  }
});

/**
 * POST /api/enhance/simplify
 * Simplify and clarify the prompt
 */
enhanceRouter.post("/simplify", async (req, res) => {
  try {
    const { prompt, attachments = [] } = req.body;
    const safeAttachments = coerceAttachments(attachments);

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        ok: false,
        error: "Missing or invalid 'prompt' field"
      });
    }

    logAttachments(safeAttachments, "/simplify");

    const attachmentContext = buildAttachmentContext(safeAttachments);
    const fullPrompt = prompt + attachmentContext;

    // Optimized: Concise system prompt
    const system = `Simplify prompt: make it concise, clear, and accessible.

CRITICAL: Output MUST differ from input. Remove complexity, use plain language, active voice.

Output: Simplified prompt only.`;

    // Optimization: Use temp 0.5 to encourage divergence in the first shot
    const { text: enhanced, model: modelUsed, completionId, similarity } = await chatText({ 
      system, 
      user: fullPrompt,
      temperature: 0.5,     // Increased from default 0.2
      minSimilarity: 0.85,
      maxRetries: 1
    });
    logModelUsage("/enhance/simplify", modelUsed, completionId);

    res.json({
      ok: true,
      result: {
        enhanced,
        attachmentsProcessed: safeAttachments.length
      }
    });

  } catch (err) {
    return handleEnhanceError(res, "/enhance/simplify", err, "Enhancement failed");
  }
});

/**
 * POST /api/enhance/score
 * Score the quality of a prompt
 */
enhanceRouter.post("/score", async (req, res) => {
  try {
    const { prompt, attachments = [] } = req.body;
    const safeAttachments = coerceAttachments(attachments);

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        ok: false,
        error: "Missing or invalid 'prompt' field"
      });
    }

    logAttachments(safeAttachments, "/score");

    const attachmentContext = buildAttachmentContext(safeAttachments);
    const fullPrompt = prompt + attachmentContext;

    const system = `You are a prompt quality evaluator. Analyze the given prompt and provide:
1. An overall score (0-10)
2. Dimension scores for: clarity, specificity, structure, completeness
3. 2-3 specific suggestions for improvement

Return ONLY a JSON object in this exact format:
{
  "score": 7.5,
  "dimensions": {
    "clarity": 8,
    "specificity": 7,
    "structure": 7,
    "completeness": 8
  },
  "suggestions": [
    "Add more specific examples",
    "Define expected output format"
  ]
}`;

    const { data: result, model: modelUsed, completionId } = await chatJson({ system, user: fullPrompt });
    logModelUsage("/enhance/score", modelUsed, completionId);

    res.json({
      ok: true,
      result: {
        ...result,
        attachmentsProcessed: safeAttachments.length
      }
    });

  } catch (err) {
    return handleEnhanceError(res, "/enhance/score", err, "Scoring failed");
  }
});

/**
 * POST /api/enhance/validate
 * Validate prompt and identify issues
 */
enhanceRouter.post("/validate", async (req, res) => {
  try {
    const { prompt, attachments = [] } = req.body;
    const safeAttachments = coerceAttachments(attachments);

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        ok: false,
        error: "Missing or invalid 'prompt' field"
      });
    }

    logAttachments(safeAttachments, "/validate");

    const attachmentContext = buildAttachmentContext(safeAttachments);
    const fullPrompt = prompt + attachmentContext;

    const system = `You are a prompt validator. Identify issues in the given prompt:
- Missing information
- Ambiguous instructions
- Potential misunderstandings
- Structural problems

Return ONLY a JSON object in this exact format:
{
  "issues": [
    {
      "level": "error",
      "message": "Missing output format specification",
      "hint": "Add 'output format: JSON' or similar"
    }
  ]
}

If no issues found, return {"issues": []}`;

    const { data: result, model: modelUsed, completionId } = await chatJson({ system, user: fullPrompt });
    logModelUsage("/enhance/validate", modelUsed, completionId);

    res.json({
      ok: true,
      result: {
        ...result,
        attachmentsProcessed: safeAttachments.length
      }
    });

  } catch (err) {
    return handleEnhanceError(res, "/enhance/validate", err, "Validation failed");
  }
});

export { enhanceRouter };

