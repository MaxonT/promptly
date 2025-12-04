# Data Pipeline Architecture

## Overview

The Promptly Data Pipeline is responsible for collecting user input from all 3 layers of the UI and transforming it into an API-ready payload for the Outcome Runner.

## Layer Structure

### Layer 1: Magic Mode (Required)
- **Task Description**: The main task the AI should perform
- **Model Selection**: Which Promptly model to use
- **Context/Examples**: Optional source material

### Layer 2: Blueprint Sync (Optional)
- **Instruction Blueprint**: How agents should approach the task
- **Demonstration Examples**: Input/output pairs for style guidance
- **Constraints & Style**: Formatting rules, length limits, tone

### Layer 3: Expert Lab (Optional)
- **POS/NEG Dataset**: Positive/negative examples to bias scoring
- **Schema Template**: Output structure requirements
- **Optimization Knobs**: Candidate count, tests, temperature

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
