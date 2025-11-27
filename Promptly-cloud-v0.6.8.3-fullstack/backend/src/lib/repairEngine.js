/**
 * Generates a repair plan based on spec, compiled prompt, run, and errors
 * @param {Object} options
 * @param {Object} [options.spec] - The spec object (if available)
 * @param {Object} [options.compiledPrompt] - The compiled prompt (if available)
 * @param {Object} options.run - The run record
 * @param {Array} options.errors - Array of error records
 * @returns {Promise<Object>} Repair plan with summary, suggested_changes, and new_prompt_blocks
 */
export async function generateRepairPlan({ spec, compiledPrompt, run, errors }) {
  // Build a summary from errors
  const errorSummary = errors
    .map((err) => `[${err.error_type || "unknown"}] ${err.details || "No details"}`)
    .join("; ");

  const summary = errors.length > 0
    ? `Found ${errors.length} error(s): ${errorSummary}`
    : "No errors found for this run";

  // Generate suggested changes based on error types
  const suggestedChanges = [];
  const errorTypes = new Set(errors.map((e) => e.error_type));

  if (errorTypes.has("missing_file")) {
    suggestedChanges.push("Check file paths and ensure all required files exist");
    suggestedChanges.push("Verify file permissions and accessibility");
  }

  if (errorTypes.has("route_mismatch")) {
    suggestedChanges.push("Review API routes and endpoint configurations");
    suggestedChanges.push("Ensure frontend and backend routes are in sync");
  }

  if (errorTypes.has("schema_error")) {
    suggestedChanges.push("Validate data schema and field requirements");
    suggestedChanges.push("Check for missing or incorrectly formatted fields");
  }

  if (errorTypes.has("runtime_exception")) {
    suggestedChanges.push("Review stack trace and fix runtime errors");
    suggestedChanges.push("Check for null/undefined values and type mismatches");
  }

  if (errorTypes.has("unknown") || suggestedChanges.length === 0) {
    suggestedChanges.push("Review error details and logs");
    suggestedChanges.push("Consider adding more specific error handling");
  }

  // For now, return existing prompt blocks if available, or empty array
  const newPromptBlocks = compiledPrompt?.blocks || [];

  return {
    summary,
    suggested_changes: suggestedChanges,
    new_prompt_blocks: newPromptBlocks
  };
}

