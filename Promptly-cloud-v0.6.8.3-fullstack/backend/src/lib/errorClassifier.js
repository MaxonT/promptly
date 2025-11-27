/**
 * Classifies errors based on raw output and optional user feedback
 * @param {string} rawOutput - The raw LLM output or error message
 * @param {string} [userFeedback] - Optional user feedback about the error
 * @returns {{ error_type: string, details: string }}
 */
export function classifyError(rawOutput, userFeedback = "") {
  const combined = `${rawOutput || ""} ${userFeedback || ""}`.toLowerCase();

  // Check for missing file errors
  if (
    combined.includes("no such file") ||
    combined.includes("file not found") ||
    combined.includes("enoent") ||
    combined.includes("cannot find file")
  ) {
    return {
      error_type: "missing_file",
      details: "File or resource not found"
    };
  }

  // Check for route/API errors
  if (
    combined.includes("404") ||
    combined.includes("route") ||
    combined.includes("endpoint not found") ||
    combined.includes("cannot get") ||
    combined.includes("cannot post")
  ) {
    return {
      error_type: "route_mismatch",
      details: "Route or endpoint mismatch"
    };
  }

  // Check for schema/validation errors
  if (
    combined.includes("schema") ||
    combined.includes("validation") ||
    combined.includes("invalid") ||
    combined.includes("expected") ||
    combined.includes("required field")
  ) {
    return {
      error_type: "schema_error",
      details: "Schema validation or data format error"
    };
  }

  // Check for runtime exceptions (stack traces, error keywords)
  if (
    combined.includes("error:") ||
    combined.includes("exception") ||
    combined.includes("at ") && combined.includes(".js:") ||
    combined.includes("stack trace") ||
    combined.includes("typeerror") ||
    combined.includes("referenceerror")
  ) {
    return {
      error_type: "runtime_exception",
      details: "Runtime exception occurred"
    };
  }

  // Default to unknown
  return {
    error_type: "unknown",
    details: "Unclassified error"
  };
}

