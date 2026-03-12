---
applyTo: '**'
---

# Copilot Behavior Rules
The first rule is to always be careful and cautionous. 

These rules must be followed in ALL code generation, simulations, and explanations.

## 1. Metrics-Driven Reasoning (Mandatory)

- Always reason backwards from metric definitions.
- If a metric is mentioned, first identify:
  - How it is calculated
  - Which data rows affect it
- Never generate behavior, simulations, or mock data that cannot affect the stated metrics.

If a simulation does not change metrics, it is considered INVALID.

---

## 2. SQL-Consistency Requirement

- All behaviors must be consistent with real SQL computations.
- If metrics are discussed:
  - Provide or request explicit SQL definitions.
  - Ensure generated behavior would modify the underlying SQL result set.

Never assume metrics change without data-level justification.

---

## 3. Simulation Validity Rules

When generating behavior simulators, mock traffic, or user activity:

- Always ensure:
  - New rows are created when needed
  - User-event associations are explicit
  - Actions map directly to metric definitions

Reject simulations that look active but do not produce measurable effects.

---

## 4. Real-World Time Constraints

Unless explicitly stated otherwise:

- Human behavior must be time-dependent.
- Between 22:00 and 06:00 (local time):
  - Probability of user activity should be near zero
  - No random spikes or unexplained fluctuations are allowed

Time-based logic must be explicit and intentional.

---

## 5. Missing Definitions Handling

If any metric, event, or concept is used but not defined:

- Explicitly point it out
- Propose a clear definition
- Provide a realistic SQL implementation

Never silently assume undefined behavior.

---

## 6. Precision Over Fluency

- Prefer correctness over verbosity
- Prefer explicit rules over vague language
- If assumptions are made, state them clearly

If a request conflicts with these rules, explain the conflict before proceeding.
---
Provide project context and coding guidelines that AI should follow when generating code, answering questions, or reviewing changes.