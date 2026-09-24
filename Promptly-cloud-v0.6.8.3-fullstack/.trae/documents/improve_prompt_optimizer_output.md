# Plan: Improve Prompt Optimizer Output

## Objective
Refine the "Precision Command Optimizer" output based on user feedback to eliminate hallucinations, handle ambiguities correctly, and align with the user's "execution" intent.

## Analysis of Feedback
1.  **Hallucinations**: The original output invented libraries, versions, and file structures. The new output must avoid this.
2.  **Ambiguity**: "Blueprint" was wrongly locked to Flask. The new output must treat this as an ambiguity or a high-probability inference (Render Blueprint vs Flask Blueprint) without locking it in as a user fact.
3.  **Tone**: The original was too bureaucratic (PRD-style). The new output must be action-oriented ("Execute").
4.  **Format**: The user provided a preferred format: Role -> Task -> Explicit Inputs -> Unspecified Inputs -> Constraints -> Output.

## Implementation Steps
1.  **Draft the "Precision Command"**:
    *   Define the Role as a pragmatic Full-stack Developer.
    *   Categorize inputs into "Explicit" and "Unspecified/Inferred".
    *   Under "Explicit", list: OAuth (Github/Google), Postgres, Render Starter, Industry Standard, Blueprint (keyword).
    *   Under "Unspecified", list: Web Framework (Note: "blueprint" likely implies Flask or Render Blueprint), specific DB schema, libraries.
    *   Define Constraints: Single delivery, Env vars, Secure defaults.
2.  **Verify against Feedback**:
    *   Did I specify Flask versions? (No)
    *   Did I specify file lists? (No, just "Complete Codebase")
    *   Did I capture the "Blueprint" ambiguity? (Yes)
3.  **Final Output Generation**:
    *   Present the refined prompt in the requested structured format.

## Deliverable
A text response containing the improved "Precision Command Optimizer - System Implementation Instruction".
