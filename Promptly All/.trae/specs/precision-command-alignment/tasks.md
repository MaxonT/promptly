# Tasks

- [x] Task 1: Update `generators[0].systemPrompt` in `backend/src/routes/pipeline.js` to align with "Precision Command" philosophy.
  - [x] SubTask 1.1: Change ROLE to "Precision Command Optimizer".
  - [x] SubTask 1.2: Add "Strict Source of Truth" rule (ban guessing/hallucination).
  - [x] SubTask 1.3: Add "Command-Oriented Output" rule (AI-to-AI directive).
  - [x] SubTask 1.4: Add "Rule Extraction & Citation" requirement.
  - [x] SubTask 1.5: Remove "Overview/Summary" instructions.

- [x] Task 2: Update `TASK_TYPE_HINTS` in `backend/src/routes/pipeline.js` to reflect the new directive style.
  - [x] SubTask 2.1: Update `analysis` hint to be "Rule extraction, strict document adherence".
  - [x] SubTask 2.2: Update `coding` hint to be "Constraint-driven implementation plan".

# Task Dependencies
- Tasks 1 and 2 modify the same file and can be executed sequentially or together.
