# Promptly Best-Prompt Pipeline – Backend Specification

**Version:** v0.7.0  
**Last Updated:** 2025-01-XX  
**Status:** ✅ Backend Implementation Complete (Frontend integration pending)

---

## 🎯 Goal

Implement the Best Prompt pipeline exactly as described in the UI:
- **Spec Builder** → **Question Engine** → **LLM Agents** → **Metrics & Scoring** → **Outcome Runner**
- Every enhancement must go through this pipeline so the final prompt is the top-ranked candidate after multi-metric scoring.

---

## 0. Core Concepts & Data Models

All examples use TypeScript-style types for clarity.

### 0.1 Entities

```typescript
type Spec = {
  id: string;
  createdAt: string;
  updatedAt: string;

  // Raw idea & context
  rawIdea: string;
  userGoal: string;
  audience?: string;
  constraints?: string[];
  tone?: string;
  format?: string;
  domain?: string;
  examples?: string[];

  // Status
  completenessScore: number; // 0–1, based on Question Engine coverage
};

type QuestionSession = {
  id: string;
  specId: string;
  createdAt: string;
  updatedAt: string;

  step: number;              // 1, 2, 3 (Q1–Q3 flow)
  questionsAsked: string[];  // history
  answers: string[];         // user answers, same length as questionsAsked
  isComplete: boolean;
};

type CandidatePrompt = {
  id: string;
  specId: string;
  sessionId?: string;

  agent: "architect" | "editor" | "judge";
  model: string;
  content: string;

  // Filled later by Metrics & Scoring
  metrics?: PromptMetrics;
};

type PromptMetrics = {
  clarity: number;        // 0–1
  coherence: number;      // 0–1
  styleMatch: number;     // 0–1
  safety: number;         // 0–1 (higher is safer)
  tokenCost: number;      // estimated tokens to run this prompt
  risk: number;           // 0–1 (higher = higher risk)

  // Derived
  passRate?: number;
  f1?: number;
  compositeScore: number; // final weighted score used by Outcome Runner
};

type Outcome = {
  id: string;
  specId: string;
  selectedCandidateId: string;
  runnerUps: { candidateId: string; compositeScore: number }[];
  reasoning: string;  // short text summary
};
```

---

## 1. High-Level Pipeline

This must be the actual backend flow for "Best Prompt" generation.

1. **Spec Builder**
   - Input: raw user idea + optional attachments.
   - Output: structured Spec JSON saved to DB.

2. **Question Engine (Q1–Q3)**
   - Uses the Spec to generate clarifying questions.
   - Maintains a QuestionSession until we decide spec is "complete enough".

3. **LLM Agents**
   - Multiple agents (Architect / Editor / Judge, etc.) each produce candidate prompts.
   - Result: `CandidatePrompt[]` linked to the spec.

4. **Metrics & Scoring**
   - Evaluate each candidate using multiple metrics.
   - Compute `PromptMetrics` + `compositeScore`.

5. **Outcome Runner**
   - Apply Outcome-First rules.
   - Select best-of-N candidate.
   - Return that candidate (plus some metadata) to the frontend Best Prompt card.

---

## 2. Endpoints & Responsibilities

### 2.1 Spec Builder

**Endpoint:** `POST /api/specs/from-idea`

**Purpose**
Turn a raw idea into a structured Spec JSON (matches UI: "Turn your raw idea into a structured spec…").

**Request**
```json
{
  "idea": "string – user's raw idea text (required)",
  "attachments": [
    {
      "name": "string",
      "type": "string",
      "size": 12345
    }
  ]
}
```

**Behavior**
1. Validate & sanitize input (similar to current Input Layer + attachment cleaning).
2. Build a system prompt that tells the LLM:
   - You are Spec Builder.
   - Extract / infer the following fields:
   - `userGoal`, `audience`, `constraints`, `tone`, `format`, `domain`, `examples`, etc.
   - Always output valid JSON matching the Spec shape (no comments, no extra text).
3. Call LLM, parse JSON safely.
4. Create Spec in DB.

**Response**
```json
{
  "ok": true,
  "spec": { /* Spec */ }
}
```

---

### 2.2 Question Engine (Q1–Q3 Flow)

**Goal in UI:** "We ask targeted follow-up questions (Q1–Q3 flow) to remove ambiguity and surface context you might forget."

#### 2.2.1 Start / Continue Question Session

**Endpoint:** `POST /api/question-sessions/next`

**Request**
```json
{
  "specId": "string",
  "sessionId": "string | null",
  "lastAnswer": "string | null"
}
```

- If `sessionId` is null → create a new session (Q1).
- If `sessionId` exists → append `lastAnswer` and move to next question.

**Backend Steps**
1. Load Spec by `specId`.
2. If `sessionId` is null:
   - Create new QuestionSession with `step = 0`, `questionsAsked = []`, `answers = []`.
3. Build System prompt for Question Engine:
   - Role: clarifying question engine.
   - Input: Spec JSON + previous Q/A history.
   - Requirements:
   - Ask one high-leverage clarifying question at a time.
   - Maximum of 3 steps (Q1–Q3).
   - Stop if incremental value is low.
4. Build User prompt:
   - Provide current Spec.
   - Provide previous questions + answers.
5. LLM returns:
   ```json
   {
     "question": "string",
     "shouldStop": false,
     "estimatedCompleteness": 0.8
   }
   ```
6. Update QuestionSession:
   - push question into `questionsAsked`
   - push `lastAnswer` into `answers` (if not first step)
   - increment `step`
   - `isComplete = shouldStop || step >= 3`
7. Update `Spec.completenessScore = estimatedCompleteness`.

**Response**
```json
{
  "ok": true,
  "session": { /* QuestionSession */ },
  "nextQuestion": "string | null",
  "isComplete": true/false,
  "spec": { /* updated Spec */ }
}
```

---

### 2.3 LLM Agents – Candidate Generation

**Goal in UI:** "Specialized agents craft multiple candidate prompts instead of relying on a single response."

We will implement at least three agents:
- **architect** – structure & logic.
- **editor** – language polish & readability.
- **judge** – risk & robustness adjustments.

**Endpoint:** `POST /api/prompts/generate-candidates`

**Request**
```json
{
  "specId": "string",
  "sessionId": "string | null",
  "model": "string | null"    // optional override; default from config
}
```

**Backend Steps**
1. Load Spec (and optionally QuestionSession).
2. Build base prompt context from spec + Q&A history.
3. For each agent in `[architect, editor, judge]`:
   - Build a dedicated system prompt, for example:
   - **Architect:** focus on structure, sections, variables, clear instructions.
   - **Editor:** focus on tone, clarity, strong wording, but keep semantics.
   - **Judge:** focus on safety constraints, guardrails, edge cases.
   - User content: base context (spec + Q&A).
   - Call LLM once per agent.
   - Each call returns a full candidate prompt text.
4. Create CandidatePrompt entries.

**Response**
```json
{
  "ok": true,
  "candidates": [
    { "id": "...", "agent": "architect", "content": "..." },
    { "id": "...", "agent": "editor", "content": "..." },
    { "id": "...", "agent": "judge", "content": "..." }
  ]
}
```

**Note:** The frontend Best Prompt card doesn't need to show all candidates, but the backend must keep them for scoring and Outcome Runner.

---

### 2.4 Metrics & Scoring

**Goal in UI:** "Every candidate is scored on clarity, coherence, style match, safety, token cost, and risk to quantify quality."

We implement a Metrics API that scores each CandidatePrompt.

**Endpoint:** `POST /api/prompts/score`

**Request**
```json
{
  "candidateIds": ["string"]
}
```

**Backend Steps**

For each candidate:
1. Compute `tokenCost` (local tokenizer or from model usage).
2. Use a Metrics LLM (or the same model, but with different system prompt) to rate:
   - `clarity`, `coherence`, `styleMatch`, `safety`, `risk` (0–1 scale).
   - The system prompt should:
   - Take the Spec and the candidate prompt.
   - Return a JSON with numeric scores 0–1.
   - Optionally `passRate` / `f1` estimates based on spec (for now we can approximate or keep null).
3. Compute `compositeScore`:
   ```javascript
   normalizedToken = idealTokenCost / tokenCost (clamped to 0–1)

   compositeScore = average(
     clarity,
     coherence,
     styleMatch,
     safety,
     1 - risk,
     normalizedToken
   )
   ```
4. Save metrics on each CandidatePrompt.

**Response**
```json
{
  "ok": true,
  "metrics": [
    {
      "candidateId": "...",
      "metrics": { /* PromptMetrics */ }
    }
  ]
}
```

---

### 2.5 Outcome Runner – Best-of-N Selection

**Goal in UI:** "The Outcome-First runner applies your success criteria, compares best-of-N candidates, and returns the most reliable result."

**Endpoint:** `POST /api/prompts/select-best`

**Request**
```json
{
  "specId": "string"
}
```

**Assumption:** CandidatePrompt entries for this `specId` already exist and have metrics.

**Backend Steps**
1. Load all CandidatePrompt for `specId` with non-null metrics.
2. If metrics are missing → call `/api/prompts/score` internally first.
3. Select candidate with max `compositeScore`.
   - In case of tie, prefer:
     1. higher `safety`
     2. lower `tokenCost`
4. Create Outcome record.
5. Return top candidate + metadata, used by Best Prompt card.

**Response**
```json
{
  "ok": true,
  "outcome": {
    "specId": "string",
    "best": {
      "id": "string",
      "content": "string",
      "agent": "architect" | "editor" | "judge",
      "metrics": { /* PromptMetrics */ }
    },
    "runnerUps": [
      { "candidateId": "...", "compositeScore": 0.91 },
      { "candidateId": "...", "compositeScore": 0.87 }
    ]
  }
}
```

---

## 3. Frontend Integration Contract (Dashboard / Best Prompt Card)

For Cursor: do not change layout; only ensure the backend returns the data needed.

The Best Prompt card should be able to:
1. Start from raw idea → call `/api/specs/from-idea`.
2. Optionally go through Q1–Q3:
   - Loop calling `/api/question-sessions/next` until `isComplete = true`.
3. Generate candidates:
   - `POST /api/prompts/generate-candidates`.
4. Score and select best prompt:
   - `POST /api/prompts/score`.
   - `POST /api/prompts/select-best`.
5. Display:
   - `outcome.best.content` as the Best Prompt.
   - Optionally show a small "pipeline summary", using:
   - `spec.completenessScore`
   - metrics from `outcome.best.metrics`
   - candidate count.

---

## 4. System Prompts Structure (High-Level)

Cursor doesn't need exact wording, but must keep these roles:

1. **Spec Builder System Prompt**
   - "You are a spec builder. Take raw idea and output structured JSON spec…"

2. **Question Engine System Prompt**
   - "You are a clarifying question engine. Given spec + Q&A, ask next high-leverage question or stop…"

3. **Agents System Prompts**
   - **Architect:** "Design the structure and variables of the prompt…"
   - **Editor:** "Polish language, improve readability without changing intent…"
   - **Judge:** "Add safety constraints, edge cases, and risk controls…"

4. **Metrics System Prompt**
   - "Given spec + candidate prompt, rate clarity, coherence, styleMatch, safety, risk on 0–1 scale, return JSON…".

All of them must return JSON or plain prompt text, no meta commentary.

---

## 5. Implementation Checklist

给 Cursor 的"待办清单"，方便它分阶段实现。

1. ✅ Create data models (Spec, QuestionSession, CandidatePrompt, PromptMetrics, Outcome) and persistence layer (SQLite / existing DB).
2. ✅ Implement `/api/specs/from-idea` using existing OpenAI client utilities.
3. ✅ Implement `/api/question-sessions/next` with Q1–Q3 loop logic and Spec.completenessScore update.
4. ✅ Implement `/api/prompts/generate-candidates` for agents architect, editor, judge.
5. ✅ Implement `/api/prompts/score` to compute metrics + compositeScore.
6. ✅ Implement `/api/prompts/select-best` (Outcome Runner).
7. ⏳ Wire the Best Prompt card to call these endpoints in sequence and show the top-ranked candidate.
8. ⏳ Ensure loading / pipeline status indicator in UI reflects these stages:
   - Spec → Question → Agents → Outcome.

---

## 6. Relationship with Existing Enhance API

The existing `/api/enhance/*` endpoints (`/structure`, `/style`, `/simplify`, etc.) are **single-shot enhancement interfaces**. They are useful for quick, one-off prompt improvements.

The **Best Prompt Pipeline** described in this document is the **complete, multi-stage pipeline** that follows the UI marketing flow:
- Spec Builder → Question Engine → LLM Agents → Metrics & Scoring → Outcome Runner

**Key Differences:**
- `/api/enhance/*` = Single LLM call, single result
- Best Prompt Pipeline = Multiple agents, multiple candidates, scoring, best-of-N selection

Both can coexist, serving different use cases.

---

## 7. Database Schema Additions

### New Table: `candidate_prompts`
```sql
CREATE TABLE IF NOT EXISTS candidate_prompts (
  id TEXT PRIMARY KEY,
  spec_id TEXT NOT NULL,
  session_id TEXT,
  agent TEXT NOT NULL,  -- 'architect', 'editor', 'judge'
  model TEXT NOT NULL,
  content TEXT NOT NULL,
  
  -- Metrics (filled later)
  clarity REAL,
  coherence REAL,
  style_match REAL,
  safety REAL,
  token_cost INTEGER,
  risk REAL,
  pass_rate REAL,
  f1_score REAL,
  composite_score REAL,
  
  created_at TEXT NOT NULL,
  CONSTRAINT fk_cp_spec FOREIGN KEY (spec_id) REFERENCES specs(id),
  CONSTRAINT fk_cp_session FOREIGN KEY (session_id) REFERENCES question_sessions(id)
);
```

### Update Table: `specs`
Add `completeness_score` column:
```sql
ALTER TABLE specs ADD COLUMN completeness_score REAL DEFAULT 0.0;
```

### Update Table: `question_sessions`
Add Q1-Q3 tracking columns:
```sql
ALTER TABLE question_sessions ADD COLUMN step INTEGER DEFAULT 0;
ALTER TABLE question_sessions ADD COLUMN is_complete INTEGER DEFAULT 0;
```

---

## 8. Error Handling

All endpoints should:
- Return consistent error format: `{ ok: false, error: "..." }`
- Handle `LlmDisabledError` gracefully (503 status)
- Log errors with context for debugging
- Provide meaningful error messages to frontend

---

## 9. Testing Strategy

1. **Unit Tests**: Test each agent's system prompt formatting
2. **Integration Tests**: Test full pipeline flow from spec → outcome
3. **E2E Tests**: Test frontend integration with all endpoints
4. **Performance Tests**: Ensure pipeline completes within reasonable time

---

## 10. Future Enhancements

- Add more agents (e.g., "safety", "performance", "accessibility")
- Support custom metrics
- Add caching for repeated spec/candidate combinations
- Implement incremental candidate generation (generate more if scores are close)

