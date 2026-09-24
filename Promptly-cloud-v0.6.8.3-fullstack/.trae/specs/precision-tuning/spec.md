# Precision Tuning Spec

## Why
User feedback indicates that the prompt generation, while improving, has become "over-specified" and "heavy". It demands unnecessary details (bounding boxes, strict injectivity proofs) that lead to hallucination or noise, while missing the mark on actionable visualization ("how to sketch"). We need to pivot from "Academic Rigor" to "Engineering Precision".

## What Changes
- **`backend/src/routes/pipeline.js`**:
    - Update `TASK_TYPE_HINTS` for `analysis`.
    - Update `generators[0].systemPrompt` ("fluent").
    - **Remove Noise**: Delete requirements for "bounding box", "range of coordinates", "injectivity proofs", "orientation justification".
    - **Refine Precision**: Replace "Provide detailed prose" with "State the set/inequality".
    - **Actionable Sketch**: Force the sketch description to be constructive (e.g., "Draw disc in rho-z plane, then rotate").
    - **Simplify Tone**: Remove emotional/academic adjectives ("rigorous", "precise", "detailed").

## Impact
- **Affected Specs**: Prompt Generation Quality.
- **Affected Code**: `backend/src/routes/pipeline.js`.

## ADDED Requirements
### Requirement: Constructive Sketch Instruction
The prompt SHALL explicitly ask for a "Constructive Sketch Description" (e.g., "Describe the generating cross-section and the axis of rotation") rather than a generic "sketch description".

### Requirement: Redundancy Check
The prompt SHALL ask the model to "Identify any coordinate redundancy (overlap) and explain why it does not affect the volume integral," instead of asking for a formal injectivity proof.

## MODIFIED Requirements
### Requirement: Geometric Description
The prompt SHALL ask for a "Set/Inequality Description" instead of "bounding box" or "spatial extent".

### Requirement: Tone Calibration
The system prompt SHALL explicitly forbid "academic filler adjectives" (e.g., "rigorous", "comprehensive", "detailed prose").

## REMOVED Requirements
### Requirement: Bounding Box
**Reason**: Leads to hallucinated intervals and isn't core to the math task.
**Migration**: Replaced by Set/Inequality Description.

### Requirement: Formal Injectivity/Orientation
**Reason**: Too heavy for standard problems; prone to model error on subtle edge cases.
**Migration**: Replaced by simple "Redundancy Check".
