# Pipeline Prompt Refinement Spec

## Why
User feedback indicates that the current pipeline generates prompts with:
1.  **Emotional/Fluff Intros**: Unnecessary "elegant/practical" language that wastes tokens.
2.  **Feeding Conclusions**: Prematurely revealing derived properties (e.g., "minor radius b") in the context, which shortcuts the model's reasoning process.
3.  **Outline Risk**: Potential to generate structured outlines instead of actionable, direct content.

## What Changes
- Modify `backend/src/routes/pipeline.js`:
    - Update `generators[0].systemPrompt` ("fluent" agent).
    - **Remove Fluff**: Add explicit rule forbidding "Introduction and Context" sections with emotional language.
    - **No Spoilers**: Add rule prohibiting the inclusion of derived conclusions in the prompt context (e.g., "Do not state the final shape name or properties if the user asks to derive them").
    - **Anti-Outline**: Add rule "Do not repeat the prompt structure; immediately start with item 1 and provide actual content, not headings-only outlines."
    - Refine style instructions to enforce directness and eliminate "preaching".

## Impact
- **Affected Specs**: Prompt Generation Quality.
- **Affected Code**: `backend/src/routes/pipeline.js` (Generator System Prompt).

## ADDED Requirements
### Requirement: No Fluff Intros
The generated prompt SHALL NOT contain "Introduction and Context" sections with emotional or qualitative descriptions (e.g., "elegant", "practical"). It must start directly with the role or task.

### Requirement: No Spoilers
The generated prompt SHALL NOT reveal the answer to a derivation task in the "Context" section (e.g., explicitly stating "this is a torus with radius b" when the user asks to "describe the image"). It should let the model derive it.

### Requirement: Anti-Outline
The generated prompt SHALL include instructions to prevent the model from outputting empty outlines or repeating the prompt structure. It must demand immediate execution.

## MODIFIED Requirements
### Requirement: Generator System Prompt
The `fluent` generator system prompt will be updated to include these new constraints and style guidelines.
