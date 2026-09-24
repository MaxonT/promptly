# Precision Command Alignment Spec

## Why
User feedback indicates that the current pipeline output is "over-fitting" and acting like a "course TA announcement" (rephrasing the manual) rather than an "optimized command" for an AI. The current output contains hallucinations (invented grading weights, file paths) and lacks strict adherence to the provided documents as the *only* source of truth. The goal is to shift from "Overview/Summary" to "Actionable Command/Directive" that respects the user's input constraints without adding noise.

## What Changes
- **`backend/src/routes/pipeline.js`**:
    - Update `generators[0].systemPrompt` ("fluent").
    - **Shift Role**: From "Instructor/Analyst" to "Precision Command Optimizer".
    - **Strict Source of Truth**: Add rule to ONLY use provided inputs/docs. Ban guessing/inventing (e.g., grading weights, paths).
    - **Command-Oriented Output**: Force the output to be a set of *executable instructions* for an AI, not a summary for a human.
    - **Document Alignment**: Require explicit extraction of rules *from the documents* (citing sources).
    - **Anti-Hallucination**: Explicitly ban inventing details not in the input.

## Impact
- **Affected Specs**: Prompt Generation Quality.
- **Affected Code**: `backend/src/routes/pipeline.js`.

## ADDED Requirements
### Requirement: Command-Oriented Output
The generated prompt SHALL be structured as a directive to an AI (e.g., "Inputs you must use...", "Goal...", "Hard constraints..."), NOT as a summary to a human.

### Requirement: Strict Source of Truth
The prompt SHALL explicitly instruct the model to use *only* the provided documents/inputs as the source of truth and to state "Not specified" if information is missing, rather than guessing.

### Requirement: Rule Extraction & Citation
The prompt SHALL ask for a "Rules Extraction" step where constraints are listed with their source (e.g., "[from project4.pdf]").

## MODIFIED Requirements
### Requirement: Generator System Prompt
The system prompt will be rewritten to enforce the "Precision Command" philosophy:
- **Role**: "Command Optimizer" instead of "Prompt Engineer" (focus on *directing* the AI).
- **Tone**: "Concise, Directive, Source-Bound".
- **Forbidden**: "Motivational text", "Invented details", "Restating the obvious without action".

## REMOVED Requirements
### Requirement: "Detailed Prose" / "Overview"
**Reason**: Leads to fluff and hallucination.
**Migration**: Replaced by "Actionable Instructions" and "Checklists".
