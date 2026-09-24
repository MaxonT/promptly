# Pipeline Cost Optimization Spec

## Why
Current pipeline costs are dominated by token usage in the Generation and Refine stages (using Claude Haiku 4.5). There are several low-hanging fruits to reduce input/output tokens without sacrificing quality, potentially reducing costs by ~23%.

## What Changes
- **`backend/src/lib/modelConfig.js`**:
    - Add `max_tokens` limits to all stage configurations.
    - Set stricter limits for Critique (400) and Evaluation (300).
- **`backend/src/routes/pipeline.js`**:
    - **System Prompt Slimming**: Remove redundant instructions and examples from Generation and Refine system prompts.
    - **Spec Pruning**: Only pass essential spec fields (User Goal, Task Type, Constraints, etc.) to Generation/Refine, filtering out non-critical fields.
    - **Conditional Pinned Terms**: Only inject the `PINNED TERMS` block if `extractPinnedTerms` returns a non-empty list.
    - **Refine Input Optimization**: Pass only the critique's `weaknesses` and `suggestions` to Refine, rather than the full critique JSON.

## Impact
- **Affected Specs**: Pipeline Cost & Efficiency.
- **Affected Code**: `backend/src/routes/pipeline.js`, `backend/src/lib/modelConfig.js`.

## ADDED Requirements
### Requirement: Max Tokens Limits
All LLM calls SHALL have a `max_tokens` parameter set in `modelConfig.js` to prevent runaway generation.
- Critique: 400 tokens
- Evaluation: 300 tokens
- Spec Builder: 600 tokens
- Generation/Refine: 2000 tokens

### Requirement: Conditional Pinned Terms
The `PINNED TERMS` block SHALL ONLY be injected into prompts if pinned terms are actually detected in the user input.

### Requirement: Spec Field Pruning
The Generation and Refine stages SHALL receive a pruned version of the Spec object containing only: `userGoal`, `task_type`, `constraints`, `successCriteria`, `antiPatterns`, `outputExpectations`, `tone`, `audience`, `domain`. Fields like `examples` (if large) or internal metadata should be omitted if not critical.

### Requirement: Refine Input Optimization
The Refine stage SHALL receive a concise summary of the Critique (Weaknesses + Suggestions) rather than the full raw JSON output.

## MODIFIED Requirements
### Requirement: System Prompt Efficiency
Generation and Refine system prompts SHALL be refactored to remove:
- "Introduction and Context" fluff (already done in previous step, but enforce here).
- Redundant "You are an expert..." boilerplate if it repeats.
- Excessive examples or "preaching" instructions.
