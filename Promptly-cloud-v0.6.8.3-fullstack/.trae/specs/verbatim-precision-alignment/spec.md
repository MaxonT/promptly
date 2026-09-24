# Verbatim Precision Alignment Spec

## Why
User feedback indicates that while the structure is improving, the system is still hallucinating details (e.g., asking for method-level time estimates when the input only asked for project-level) and paraphrasing instructions that were already perfect. The goal is to enforce a "Verbatim First" philosophy: if the user's input contains a clear instruction, use it exactly as is. Do not "improve" or "expand" perfectly good specs.

## What Changes
- **`backend/src/routes/pipeline.js`**:
    - Update `generators[0].systemPrompt` ("fluent").
    - **Add "Verbatim Gold" Rule**: Explicitly instruct the model to prefer quoting the user's original text over rephrasing, especially for specific questions or requirements.
    - **Tighten Anti-Hallucination**: Specifically ban "expanding" lists or requirements (e.g., "Do not break down single items into sub-items unless requested").
    - **Refine "Source of Truth"**: Emphasize that "Interpretation" should only happen if the input is ambiguous; otherwise, "Transcription" is preferred.

## Impact
- **Affected Specs**: Prompt Generation Quality.
- **Affected Code**: `backend/src/routes/pipeline.js`.

## ADDED Requirements
### Requirement: Verbatim Preference
The prompt SHALL explicitly state: "If the input provides a clear instruction, requirement, or question list, PREFER QUOTING IT VERBATIM over rephrasing or summarizing."

### Requirement: No Expansion
The prompt SHALL explicitly ban expanding requirements beyond what is written (e.g., if input says "estimate time", do not change it to "estimate time for each method").

## MODIFIED Requirements
### Requirement: Generator System Prompt
The system prompt will be updated to include the "Verbatim Gold" rule and strengthen the anti-hallucination constraints regarding "creative expansion".
