# Tasks

- [x] Task 1: Update `generators[0].systemPrompt` in `backend/src/routes/pipeline.js` to enforce "Convergent Diagnostics".
  - [x] SubTask 1.1: Add "TRIAGE FIRST" rule: P0 (Basics) -> P1 (Config) -> P2 (Advanced).
  - [x] SubTask 1.2: Add "INPUT DISTINCTION" rule: Separate "Provided Inputs" from "Required Inputs".
  - [x] SubTask 1.3: Downgrade advanced checks (CDN, Race conditions) from "Hard Constraints" to "Conditional".

- [x] Task 2: Verify alignment with "Precision Command" philosophy.
  - [x] SubTask 2.1: Ensure no hallucinated files (e.g., "I have checked your config...").
  - [x] SubTask 2.2: Ensure the output flow is logical and step-by-step.

# Task Dependencies
- Task 1 is the primary implementation step.
