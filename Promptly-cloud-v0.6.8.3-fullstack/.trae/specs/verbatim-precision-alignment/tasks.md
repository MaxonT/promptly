# Tasks

- [x] Task 1: Update `generators[0].systemPrompt` in `backend/src/routes/pipeline.js`.
  - [x] SubTask 1.1: Add "VERBATIM GOLD" rule: Prefer quoting clear instructions verbatim over rephrasing.
  - [x] SubTask 1.2: Add "NO EXPANSION" rule: Do not invent breakdowns or sub-tasks not in the input.
  - [x] SubTask 1.3: Strengthen "SOURCE OF TRUTH" rule: Emphasize "Transcription" over "Interpretation" for explicit requirements.

- [x] Task 2: Verify alignment with "Precision Command" philosophy.
  - [x] SubTask 2.1: Ensure no conflicting instructions (e.g., "be concise" vs "quote verbatim").
  - [x] SubTask 2.2: Ensure the output structure still follows the "Directive" format.

# Task Dependencies
- Task 1 is the primary implementation step.
