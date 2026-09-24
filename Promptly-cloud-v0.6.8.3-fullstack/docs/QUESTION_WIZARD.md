# Question Wizard Documentation

**Version:** v0.6.8.3  
**Last Updated:** 2025-12-04

---

## Overview

The Question Wizard is an interactive guided flow that helps users create detailed project specifications through a series of intelligent questions. It uses LLM agents to generate contextual questions based on the user's project description.

---

## Mode Comparison

### Quick Reference Table

| Feature | Fast (A+) | Deep (S) | Ultra (S+) |
|---------|-----------|----------|------------|
| Chain Length | 2 | 4 | 6 |
| Max Steps | 3 | 6 | 8 |
| Timeout | 60s | 120s | 180s |
| Expected Time | 10-40s | 30-90s | 90-180s |
| Question Depth | Basic | Moderate | Comprehensive |
| Reasoning Chains | Minimal | Balanced | Maximum |
| Best For | Quick projects | Standard projects | Complex enterprise |

### Mode Details

#### Fast Mode (A+)
- **Chain Length:** 2 reasoning chains
- **Max Steps:** 3 planning steps
- **Timeout:** 60 seconds
- **Description:** Quick response with minimal reasoning. Best for simple projects where speed is prioritized over depth.
- **Use Cases:**
  - Quick prototypes
  - Simple CRUD applications
  - Personal projects
  - Time-sensitive tasks

#### Deep Thinking Mode (S) - Default
- **Chain Length:** 4 reasoning chains
- **Max Steps:** 6 planning steps
- **Timeout:** 120 seconds
- **Description:** Balanced depth and speed. Recommended for most projects. Provides thorough analysis without excessive wait times.
- **Use Cases:**
  - Standard web applications
  - API development
  - Business applications
  - Most production projects

#### Ultra Thinking Mode (S+)
- **Chain Length:** 6 reasoning chains
- **Max Steps:** 8 planning steps
- **Timeout:** 180 seconds
- **Description:** Maximum reasoning depth. Takes longer but provides the most comprehensive spec. Best for complex enterprise applications.
- **Use Cases:**
  - Enterprise systems
  - Complex architectures
  - Mission-critical applications
  - Projects requiring extensive planning

---

## Question Types

The wizard generates several types of questions:

| Type | Description | UI Element |
|------|-------------|------------|
| `single_choice` | Select one option from a list | Pill buttons (one selected) |
| `multi_choice` | Select multiple options | Pill buttons (multiple selected) |
| `yes_no` | Binary yes/no choice | Yes/No pill buttons |
| `short_text` | Free-text short answer | Text input field |

### Depth Questions

Some questions have "depth" follow-ups when enabled:

```javascript
{
  "type": "single_choice",
  "content": "What is the primary purpose?",
  "depth_enabled": true,
  "depth_question": "Can you elaborate on this choice?",
  "depth_levels": ["basic", "detailed", "comprehensive"]
}
```

---

## API Reference

### Start Session

**`POST /api/question-sessions`**

```json
{
  "initial_description": "Build an e-commerce shopping cart",
  "kind": "web",
  "mode": "deep",
  "model": "promptly-mini"
}
```

Response:
```json
{
  "ok": true,
  "session_id": "sess_xxxxxxxxxxxxxxxx",
  "mode": "deep",
  "model": "promptly-mini",
  "mode_profile": {
    "id": "deep",
    "label": "Deep Thinking",
    "chainLength": 4,
    "maxSteps": 6,
    "timeoutMs": 120000
  },
  "questions": [...]
}
```

### Submit Answers

**`POST /api/question-sessions/:sessionId/answer`**

```json
{
  "answers": [
    { "question_id": "q_xxx", "value": "option_1" },
    { "question_id": "q_yyy", "value": true }
  ],
  "model": "promptly-mini"
}
```

### Check Status

**`GET /api/question-sessions/status/active`**

Returns current wizard session status for cross-page persistence.

```json
{
  "ok": true,
  "running": true,
  "session": {
    "id": "sess_xxx",
    "status": "active",
    "mode": "deep"
  },
  "progress": {
    "answered": 10,
    "total": 20
  }
}
```

### Finalize Session

**`POST /api/question-sessions/:sessionId/finalize`**

Generates the final spec and compiled prompt from all answers.

```json
{
  "ok": true,
  "session_id": "sess_xxx",
  "spec_id": "spec_xxx",
  "spec": { ... },
  "compiled_prompt": {
    "blocks": [...],
    "explanation": "..."
  }
}
```

### Save/Restore Snapshots

**`POST /api/question-sessions/:sessionId/snapshot`** - Save current progress

**`GET /api/question-sessions/:sessionId/snapshot/latest`** - Restore latest snapshot

---

## Frontend Integration

### Global Status Indicator

The wizard integrates with the global status manager for cross-page visibility:

```javascript
// Mark wizard as running
window.promptlyWizardSession.markRunning(sessionId);

// Clear wizard status
window.promptlyWizardSession.clear();

// Check if wizard is active
const session = window.promptlyWizardSession.getActive();
```

### Storage Keys

| Key | Storage | Purpose |
|-----|---------|---------|
| `promptly.wizard.session` | localStorage | Session ID persistence |
| `promptly:global-status` | sessionStorage | Status bar state |
| `promptly-wizard-mode` | sessionStorage | Selected mode |
| `promptly:model-selection` | sessionStorage | Selected model |

### Auto-Save

Answers are automatically saved with a 2-second debounce:

```javascript
function onAnswerChange() {
  triggerAutoSave();  // 2s debounce
  updateAnswerGuidance();  // Live counter update
}
```

---

## Pagination

Questions are paginated for better UX:

- **Page Size:** 5 questions per page
- **Progress Indicator:** "Page 1 of 3 • Questions 1–5 of 20"
- **Navigation:** Back/Next buttons with smooth animations

---

## Error Handling

| Error | User Message | Recovery |
|-------|--------------|----------|
| LLM Disabled | "LLM disabled: OPENAI_API_KEY not set" | Check environment variables |
| Invalid API Key | "Invalid OpenAI API Key" | Verify OPENAI_API_KEY |
| Timeout | "Taking longer than usual" | Wait or retry |
| Network Error | "Could not start the wizard" | Check connection |

---

## Best Practices

1. **Choose the right mode:**
   - Use Fast for quick iterations
   - Use Deep for standard projects (recommended)
   - Use Ultra only for complex enterprise systems

2. **Answer thoroughly:**
   - More answers = better spec
   - Use depth questions when available
   - Don't skip unless necessary

3. **Save snapshots:**
   - Use "Save snapshot" for long sessions
   - Restore if browser crashes

4. **Monitor timing:**
   - Watch the elapsed time counter
   - Expect longer times with Ultra mode

---

## Technical Implementation

### Mode Enforcement

Modes are enforced at multiple levels:

1. **Frontend:** Sets mode in session creation request
2. **Backend:** Resolves mode profile in `resolveModeProfile()`
3. **LLM Agents:** Receive mode parameters in prompts
4. **Timeout:** Enforced via `runWithTimeout()` wrapper

### Question Generation Flow

```
1. User submits project description
2. Backend generates "broad questions" (high-level topics)
3. Broad questions expanded to "choice questions" (specific)
4. Questions stored in database with order_index
5. First batch (5 questions) returned to frontend
6. User answers → submit → next batch or finalize
```

### Spec Generation Flow

```
1. All Q&A pairs collected from database
2. LLM generates structured spec (title, actors, flows, etc.)
3. Spec compiled to prompt blocks
4. Stored in specs and compiled_prompts tables
5. Session marked as "completed"
```

---

## Troubleshooting

### Wizard takes too long

- Try Fast mode for quicker responses
- Check network connection
- Verify OpenAI API key is valid and has quota

### Questions seem repetitive

- Use Ultra mode for more varied questions
- Provide more detail in initial description

### Answers not saving

- Check browser console for errors
- Verify session is still active
- Try saving a snapshot manually

### Status indicator not updating

- Refresh the page
- Check if session is still running
- Verify backend is accessible

---

## Version History

| Version | Changes |
|---------|---------|
| 0.6.8.3 | Added mode comparison table, enhanced documentation |
| 0.6.8.0 | Initial Question Wizard release |
