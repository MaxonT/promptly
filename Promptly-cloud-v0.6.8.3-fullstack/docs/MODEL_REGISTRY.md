# Model Registry

## Overview

The Model Registry provides centralized configuration for all Promptly model variants. It maps frontend model names to actual OpenAI model identifiers and stores metadata for each model.

## Model Tiers

| Tier | Description | Cost Multiplier |
|------|-------------|-----------------|
| mini | Fast, efficient | 1x |
| standard | Balanced | 2-3x |
| plus | Enhanced | 5x |
| pro | Advanced | 8x |
| pro-max | Maximum | 10x |

## Model Categories

| Category | Description |
|----------|-------------|
| general | All-purpose tasks |
| code | Programming and development |
| creative | Writing and content (future) |
| analysis | Research and analysis (future) |

## Available Models

### General Purpose

| Model ID | OpenAI Model | Tier | Max Tokens |
|----------|--------------|------|------------|
| promptly-mini | gpt-4o-mini | mini | 4096 |
| promptly | gpt-4o | standard | 8192 |
| promptly-plus | gpt-4o | plus | 8192 |
| promptly-pro | gpt-4o | pro | 16384 |
| promptly-pro-max | gpt-4o | pro-max | 32768 |

### Code Specialized

| Model ID | OpenAI Model | Tier | Max Tokens |
|----------|--------------|------|------------|
| promptly-code-mini | gpt-4o-mini | mini | 4096 |
| promptly-code | gpt-4o-mini | standard | 8192 |
| promptly-code-plus | gpt-4o | plus | 16384 |
| promptly-code-pro | gpt-4o | pro | 32768 |
| promptly-code-pro-max | gpt-4o | pro-max | 32768 |

## API Reference

### `getModelConfig(modelId)`
Get complete configuration for a model.

```javascript
import { getModelConfig } from './modelRegistry.js';

const config = getModelConfig('promptly-code-pro');
// {
//   id: 'promptly-code-pro',
//   provider: 'openai',
//   model: 'gpt-4o',
//   tier: 'pro',
//   category: 'code',
//   ...
// }
```

### `resolveModelName(modelId)`
Get the actual OpenAI model name.

```javascript
import { resolveModelName } from './modelRegistry.js';

resolveModelName('promptly-plus'); // 'gpt-4o'
resolveModelName('promptly-mini'); // 'gpt-4o-mini'
```

### `isPlaceholder(modelId)`
Check if a model has a planned future upgrade.

```javascript
import { isPlaceholder } from './modelRegistry.js';

isPlaceholder('promptly-plus'); // true (will upgrade to gpt-4-turbo)
isPlaceholder('promptly-mini'); // false
```

### `getUpgradePath(modelId)`
Get future upgrade information.

```javascript
import { getUpgradePath } from './modelRegistry.js';

getUpgradePath('promptly-pro');
// {
//   currentModel: 'gpt-4o',
//   futureModel: 'gpt-4-turbo',
//   description: 'Promptly Pro will upgrade from gpt-4o to gpt-4-turbo'
// }
```

### `getModelsByCategory(category)`
Get all models in a category.

```javascript
import { getModelsByCategory } from './modelRegistry.js';

const codeModels = getModelsByCategory('code');
// Returns array of code-specialized model configs
```

### `buildSystemPrompt(basePrompt, modelId)`
Build complete system prompt with model-specific suffix.

```javascript
import { buildSystemPrompt } from './modelRegistry.js';

const prompt = buildSystemPrompt('You are a helpful assistant.', 'promptly-code-pro');
// 'You are a helpful assistant.
//
// You are an expert senior software engineer AI assistant...'
```

## Code-Specialized Models

Code models include a `systemPromptSuffix` that enhances coding capabilities:

```javascript
// promptly-code-mini, promptly-code
"You are an expert code-focused AI assistant. Prioritize code quality, best practices, and clear explanations."

// promptly-code-plus
"You are an expert code-focused AI assistant. Prioritize code quality, best practices, architecture patterns, and maintainability."

// promptly-code-pro
"You are an expert senior software engineer AI assistant. Prioritize production-ready code, security, performance, and comprehensive documentation."

// promptly-code-pro-max
"You are an expert principal engineer AI assistant. Prioritize enterprise-grade code, scalability, security, comprehensive testing, and architectural excellence."
```

## Future Upgrades

The `_futureModel` field indicates planned upgrades:

| Current | Future |
|---------|--------|
| gpt-4o | gpt-4-turbo |

When new models become available, update the `model` field while keeping `_futureModel` for documentation.

## Provider Abstraction

The registry includes provider abstraction for future Anthropic/Claude support:

```javascript
export const MODEL_PROVIDERS = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic' // Future support
};
```
