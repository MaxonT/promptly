# Data Pipeline Architecture

**Version:** v0.6.8.3  
**Last Updated:** 2025-12-04

---

## Overview

The Promptly Data Pipeline is responsible for collecting user input from all 3 layers of the UI and transforming it into an API-ready payload for the Outcome Runner.

---

## Layer Structure

### Layer 1: Magic Mode (Required)
- **Task Description**: The main task the AI should perform
- **Model Selection**: Which Promptly model to use
- **Context/Examples**: Optional source material

**Required Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `task` | string | ✅ Yes | Main task description (min 1 character) |
| `model` | string | ❌ No | Model ID (default: promptly-mini) |
| `examples` | string | ❌ No | Context or example data |

### Layer 2: Blueprint Sync (Optional)
- **Instruction Blueprint**: How agents should approach the task
- **Demonstration Examples**: Input/output pairs for style guidance
- **Constraints & Style**: Formatting rules, length limits, tone

**Optional Fields:**
| Field | API Field | Type | Description |
|-------|-----------|------|-------------|
| `blueprintInstructions` | `input` | string | Detailed instructions |
| `blueprintExamples` | `style` | string | Style examples |
| `blueprintConstraints` | `constraints` | string | Formatting rules |

### Layer 3: Expert Lab (Optional)
- **POS/NEG Dataset**: Positive/negative examples to bias scoring
- **Schema Template**: Output structure requirements
- **Optimization Knobs**: Candidate count, tests, temperature

**Optional Fields:**
| Field | API Field | Type | Description |
|-------|-----------|------|-------------|
| `posNegDataset` | `dataset` | string | POS/NEG examples |
| `schemaTemplate` | `schema` | string | Output structure |
| `optimizationKnobs` | (parsed) | YAML | Advanced settings |

---

## Data Aggregator API

```javascript
// Create aggregator instance
const aggregator = new PromptlyDataAggregator();

// Collect data from all layers
aggregator.collect();

// Validate required fields
const validation = aggregator.validate();
if (!validation.isValid) {
  console.error(validation.errors);
}

// Transform to API format
const payload = aggregator.toAPI();

// Get human-readable summary
const summary = aggregator.getSummary();
console.log(summary.description);
```

## API Payload Structure

```json
{
  "task": "User's main task description",
  "model": "promptly-mini",
  "n": 4,
  "examples": "Optional context from Layer 1",
  "input": "Layer 2 instruction blueprint",
  "style": "Layer 2 demonstration examples",
  "constraints": "Layer 2 constraints & style",
  "dataset": "Layer 3 POS/NEG snippets",
  "schema": "Layer 3 output template",
  "tests": { "from": ["clarity", "risk"] },
  "temperature": 0.5,
  "_meta": {
    "layer2Used": true,
    "layer3Used": true,
    "timestamp": "2025-12-04T...",
    "version": "0.6.8.3"
  }
}
```

## Panel Detection

The aggregator automatically detects whether Layer 2/3 panels are:
1. **Open**: Panel has `layer-panel--open` class
2. **Filled**: At least one textarea has content

Data from closed or empty panels is not sent to the backend.

## YAML-like Settings Parser

Layer 3 optimization knobs support YAML-like syntax:

```yaml
candidates: 4
tests: ["clarity", "risk"]
temperature: 0.5
```

Parsed into:

```javascript
{
  candidates: 4,
  tests: ["clarity", "risk"],
  temperature: 0.5
}
```

## Integration

The data aggregator is integrated into the Run Optimization button handler:

```javascript
runBtn.addEventListener("click", async () => {
  const aggregator = new PromptlyDataAggregator();
  aggregator.collect();
  
  const validation = aggregator.validate();
  if (!validation.isValid) {
    showToast(validation.errors[0], 'error');
    return;
  }
  
  const payload = aggregator.toAPI();
  const response = await fetch('/api/outcome-runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
});
```

---

## Backend Processing

### Logging

The backend logs Layer 2/3 data at each stage for verification:

```javascript
// Example log output
[outcomeRunner] Request received:
  - Task: Classify sentiment of customer reviews...
  - Model: promptly-mini
  - Candidates (n): 4
  - Layer 2 fields present: [input, style, constraints]
  - Layer 3 fields present: [dataset, temperature]
```

### Prompt Construction

Layer 2/3 data is incorporated into the prompt:

```
[Task Description]
Classify sentiment of customer reviews

[Context]
From input field...

[Style]
From style field...

[Blueprint Instructions]
From blueprintInstructions field...

[POS/NEG Dataset]
From dataset field...

[Schema Template]
From schema field...
```

### Validation

The backend validates all fields using Zod schemas:

```javascript
const OutcomeRunRequestSchema = z.object({
  // Layer 1 (required)
  task: z.string().trim().min(1, "Task description is required"),
  
  // Layer 1 (optional)
  model: z.string().optional(),
  n: z.number().int().min(1).max(8).optional(),
  
  // Layer 2 fields
  input: z.string().optional(),
  style: z.string().optional(),
  constraints: z.string().optional(),
  
  // Layer 3 fields
  dataset: z.string().optional(),
  schema: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  
  // Metadata
  _meta: z.object({
    layer2Used: z.boolean().optional(),
    layer3Used: z.boolean().optional()
  }).optional()
});
```

---

## Metadata Tracking

The `_meta` object tracks layer usage:

```json
{
  "_meta": {
    "layer2Used": true,
    "layer3Used": false,
    "timestamp": "2025-12-04T12:00:00.000Z",
    "version": "0.6.8.3"
  }
}
```

This metadata is:
- Stored in `request_json` column for traceability
- Used for analytics and debugging
- Displayed in admin dashboards

---

## Testing

Tests are available in:
- `frontend/lib/__tests__/dataAggregator.test.js` - 50 tests
- `backend/src/lib/__tests__/metricsEngine.test.js` - 56 tests

Run tests:
```bash
# Frontend tests
cd frontend && node lib/__tests__/dataAggregator.test.js

# Backend tests
cd backend && node src/lib/__tests__/metricsEngine.test.js
```

---

## Troubleshooting

### Layer 2/3 data not being sent

1. Check if panel has `layer-panel--open` class
2. Verify textarea has content
3. Check browser console for validation errors

### Invalid payload errors

1. Ensure task is not empty
2. Check temperature is between 0-2
3. Verify n is between 1-8

### Data not affecting generation

1. Check backend logs for Layer data confirmation
2. Verify prompt construction includes your data
3. Check that model supports your requested features
