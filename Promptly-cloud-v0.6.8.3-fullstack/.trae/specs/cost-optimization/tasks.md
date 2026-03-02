# Tasks

- [x] Task 1: Update `backend/src/lib/modelConfig.js` to add `max_tokens` limits.
  - [x] SubTask 1.1: Add `max_tokens` to `generation` config (2000).
  - [x] SubTask 1.2: Add `max_tokens` to `refine` config (2000).
  - [x] SubTask 1.3: Add `max_tokens` to `critique` config (400).
  - [x] SubTask 1.4: Add `max_tokens` to `evaluation` config (300).
  - [x] SubTask 1.5: Add `max_tokens` to `specBuilder` config (600).

- [x] Task 2: Implement Conditional Pinned Terms Injection in `backend/src/routes/pipeline.js`.
  - [x] SubTask 2.1: Ensure `pinnedTermsBlock` is only constructed if `pinnedTerms.length > 0`. (Already exists, verify efficiency).

- [x] Task 3: Implement Spec Field Pruning in `backend/src/routes/pipeline.js`.
  - [x] SubTask 3.1: Create `prunedSpec` object containing only essential fields.
  - [x] SubTask 3.2: Use `prunedSpec` in Generation prompt context.

- [x] Task 4: Optimize Refine Input in `backend/src/routes/pipeline.js`.
  - [x] SubTask 4.1: Modify `refineSystem` prompt to receive a concise Critique summary (Weaknesses + Suggestions) instead of full JSON.

- [x] Task 5: Slim Down System Prompts in `backend/src/routes/pipeline.js`.
  - [x] SubTask 5.1: Remove remaining redundant instructions from `fluent` generator prompt.
  - [x] SubTask 5.2: Remove redundant instructions from `refineSystem` prompt.

# Task Dependencies
- Tasks 1-5 can be done in parallel as they touch different parts of `pipeline.js` or `modelConfig.js`.
