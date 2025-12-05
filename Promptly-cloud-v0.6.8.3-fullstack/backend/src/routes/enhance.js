/**
 * ATTACHMENT FEATURE - Enhance Routes
 * 
 * Handles prompt enhancement requests with optional file attachments.
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
 * Sanitize attachment name for safe inclusion in LLM prompts
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
 * Build attachment context for LLM
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

  // Use clear, distinctive boundaries that are unlikely to be confused
  // with user content or system instructions
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
 */
enhanceRouter.post("/structure", async (req, res) => {
  try {
    const { prompt, attachments = [] } = req.body;
    const safeAttachments = coerceAttachments(attachments);

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        ok: false,
        error: "Missing or invalid 'prompt' field"
      });
    }

    // Log attachments if present
    logAttachments(safeAttachments, "/structure");

    // Build enhanced prompt with attachment context
    const attachmentContext = buildAttachmentContext(safeAttachments);
    const fullPrompt = prompt + attachmentContext;

    // Call LLM for structure enhancement
    const system = `You are a prompt engineering expert. Your task is to restructure the given prompt to be:
1. Clear and well-organized
2. Logically structured with sections
3. Easy to understand and follow
4. Optimized for LLM comprehension

Return only the enhanced prompt. Do not add explanations.`;

    const { text: enhanced } = await chatText({ system, user: fullPrompt });

    res.json({
      ok: true,
      result: {
        enhanced,
        attachmentsProcessed: safeAttachments.length
      }
    });

  } catch (err) {
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

    const system = `You are a prompt engineering expert. Your task is to improve the style and tone of the given prompt to be:
1. Professional and clear
2. Appropriate tone for the context
3. Concise yet comprehensive
4. Engaging and effective

Return only the enhanced prompt. Do not add explanations.`;

    const { text: enhanced } = await chatText({ system, user: fullPrompt });

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

    const system = `You are a prompt engineering expert. Your task is to simplify the given prompt to be:
1. More concise and direct
2. Easier to understand
3. Free of unnecessary complexity
4. Clear in intent

Return only the simplified prompt. Do not add explanations.`;

    const { text: enhanced } = await chatText({ system, user: fullPrompt });

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

    const { data: result } = await chatJson({ system, user: fullPrompt });

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

    const { data: result } = await chatJson({ system, user: fullPrompt });

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

