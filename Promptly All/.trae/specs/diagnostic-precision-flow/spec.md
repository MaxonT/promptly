# Diagnostic Precision Flow Spec

## Why
User feedback indicates that the current diagnostic prompts (e.g., for sitemap debugging) are "over-engineered" with high-risk hallucination traps (e.g., demanding CDN checks as P0 hard constraints) and lack a logical "convergent" flow. The system jumps to advanced/rare causes before verifying basics. We need to enforce a "Triage First, Deep Dive Later" philosophy to align with professional engineering practices.

## What Changes
- **`backend/src/routes/pipeline.js`**:
    - Update `generators[0].systemPrompt` ("fluent").
    - **Add "Convergent Diagnostics" Rule**: Enforce a strict P0 -> P1 -> P2 order for troubleshooting.
        - P0: Basic verification (Status codes, robots.txt, syntax).
        - P1: Configuration checks (Redirects, Canonical, Headers).
        - P2: Advanced/Edge cases (CDN, race conditions, parameters).
    - **Refine "Input Source" Definition**: Explicitly distinguish between "Provided Inputs" (facts) and "Required Inputs" (what to ask for), preventing the model from assuming it *has* files it doesn't.
    - **Downgrade High-Risk Checks**: Move "CDN", "Cache", "Race Conditions" from "Hard Constraints" to "Conditional Checks" (only if P0/P1 pass).

## Impact
- **Affected Specs**: Prompt Generation Quality (specifically for debugging/analysis tasks).
- **Affected Code**: `backend/src/routes/pipeline.js`.

## ADDED Requirements
### Requirement: Triage-First Flow
The prompt SHALL instruct the model to prioritize diagnostic steps: "Verify P0 (Basics) -> P1 (Config) -> P2 (Advanced)". It must NOT ask for P2 checks unless P0/P1 are inconclusive or applicable.

### Requirement: Input Distinction
The prompt SHALL explicitly separate "Inputs Provided" (what user pasted) from "Inputs Needed" (what user needs to provide/check), preventing the "I have checked your vercel.json" hallucination when the file wasn't provided.

## MODIFIED Requirements
### Requirement: Generator System Prompt
The system prompt will be updated to include the "Convergent Diagnostics" rule and the "Input Distinction" logic.

## REMOVED Requirements
### Requirement: Hard-coded Advanced Checks
**Reason**: Demanding "Check CDN" as a hard constraint for every bug leads to hallucination and wasted effort.
**Migration**: Moved to P2/Conditional checks.
