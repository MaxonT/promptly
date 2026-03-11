# Plan: Refine Boss Mode to "Structural Organizer"

The user requires a strict "Zero Invention" approach where the AI acts as an **Organizer** rather than an Optimizer. The goal is to restructure the user's raw input into a clear, actionable list without adding *any* new information, while preserving the user's specific commands and tone.

## Objective
Update the `DirectOptimizer` system prompt in `backend/src/routes/pipeline.js` to produce output that matches the user's "Ideal Output" format.

## Core Rules for New Prompt
1.  **Language Mirroring**: Output MUST be in the same language as the input (Chinese -> Chinese).
2.  **Strict Zero Invention**: "If not said = does not exist = do not write".
3.  **Structural Reorganization**: Group user inputs into logical categories (e.g., "Implementation Content", "Deployment", "Visual Changes", "Requirements") instead of fixed PRD headers.
4.  **Disambiguation Only**: Only expand clear abbreviations (e.g., "postgre" -> "PostgreSQL"). Do NOT infer missing architectural components (e.g., session management).
5.  **Tone Preservation**: Capture imperative constraints like "One-time delivery", "Do not miss anything".

## Implementation Steps

### 1. Modify `backend/src/routes/pipeline.js`
- Locate the `SYSTEM_PROMPT` variable within the `DirectOptimizer` stage.
- Replace it with a new prompt designed to act as a "Structural Organizer".
- **Prompt Logic**:
    - Role: You are a Secretary/Organizer, not a Consultant.
    - Input: Raw stream of consciousness.
    - Output: Structured list.
    - Headers: Dynamic based on content (e.g., "Visual Adjustments", "Backend Logic", "Constraints").
    - Style: Concise bullet points. No introductory fluff.

### 2. Verify against User's Test Cases
- **Case A (Blueprint/OAuth)**:
    - Input: "Need OAuth (Github+Google), Postgres DB, Render Starter. One-time delivery."
    - Expected Output: Grouped into "Implementation", "Environment", "Requirements".
- **Case B (UI Tweaks)**:
    - Input: "Scale down, slow scroll, custom cursor (light/dark), fix nav alignment, optimize logo."
    - Expected Output: Grouped into "Visual Changes", "Performance", "Constraints".

## Verification
- Since I cannot run the LLM locally with the user's key to verify the *exact* output text, I will ensure the *prompt instructions* explicitly enforce these rules.
- The user will verify the output via the "Boss Mode" live preview.
