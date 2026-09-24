# Plan: Optimize Pipeline for Math Accuracy and Conciseness

The user has identified three critical issues with the current prompt generation pipeline (v2.2):
1.  **Verbosity/Templating**: The generated prompt is too long and "preachy".
2.  **Hallucination/Correction**: The system incorrectly "corrected" a mathematical domain constraint ($\phi \in [0, 2\pi) \to [0, \pi]$).
3.  **Missing Deliverables**: The generated prompt failed to enforce specific output formats (geometric expression, sketch description, closed-form volume).

To address these, I will modify `backend/src/routes/pipeline.js` to tighten the Spec Builder's extraction logic and the Generator's style instructions.

## Step 1: Enhance Spec Builder (Stage 1)
**Goal**: Prevent "correction" of constraints and ensure output requirements are captured.

*   **File**: `backend/src/routes/pipeline.js`
*   **Action**: Update `specSystem` prompt.
*   **Changes**:
    *   Add a **CRITICAL RULE** against normalizing mathematical constraints. explicitly mentioning domain ranges.
    *   Add a **RULE** to extract specific "Deliverables" into `outputExpectations` or `successCriteria`.
    *   Update the `outputExpectations` field description to be more demanding ("Must include specific artifacts requested by user").

## Step 2: Optimize Candidate Generator (Stage 3)
**Goal**: Reduce verbosity and enforce specific deliverables in the output prompt.

*   **File**: `backend/src/routes/pipeline.js`
*   **Action**: Update `generators[0].systemPrompt` ("fluent" agent) and `TASK_TYPE_HINTS`.
*   **Changes**:
    *   **Style**: Change "Use clear section headers..." to "Use concise bullet points. Avoid conversational filler. No 'preaching'."
    *   **Constraint Handling**: Explicitly instruct to include the *exact* constraints from the Spec.
    *   **Output Format**: Instruct to generate a *specific* "Output Format" section that demands the concrete deliverables (sketch description, formulas) rather than generic "Analysis".
    *   **Task Hints**: Update `analysis` hint to focus on "derivations, specific final results, and rigorous edge case handling".

## Step 3: Verification
*   **Action**: I cannot run the full pipeline without the LLM keys (which are env vars), but I can verify the prompt strings are updated in the code.
*   **Review**: I will read back the modified file to ensure the prompts are correctly updated.
