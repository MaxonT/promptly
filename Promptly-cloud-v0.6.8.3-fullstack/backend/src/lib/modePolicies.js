
/**
 * Official Mode Policies Configuration
 * 
 * Defines the strict execution policies for each optimization mode.
 * Controls provider selection, model selection, and stage behavior.
 */

export const MODE_POLICIES = {
  // 🟢 MODE: FAST (Default / Hero Click)
  fast: {
    id: 'fast',
    name: 'Fast',
    description: 'Default assumptions, no clarification, ultra-low cost.',
    
    // Stage 1 — Spec Builder
    specBuilder: {
      provider: 'groq',
      model: 'llama-3.1-8b-instant'
    },
    
    // Stage 2 — Question Engine
    questionEngine: {
      enabled: false, // ❌ MUST NOT EXIST in Fast mode
      provider: 'groq',
      model: 'llama-3.1-8b-instant'
    },
    
    // Stage 3 — Generate ×3
    generation: {
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
      count: 3
    },
    
    // Stage 4 — Scoring ×3
    scoring: {
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
      temperature: 0
    },
    
    // Stage 5 — Outcome Runner
    outcomeRunner: {
      provider: 'groq',
      model: 'llama-3.1-8b-instant'
    }
  },

  // 🔵 MODE: STANDARD (Primary Product Mode)
  standard: {
    id: 'standard',
    name: 'Standard',
    description: 'Limited clarification, strong synthesis, controlled cost.',
    
    // Stage 1 — Spec Builder
    specBuilder: {
      provider: 'openai',
      model: 'gpt-4o-mini'
    },
    
    // Stage 2 — Question Engine
    questionEngine: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      max_rounds: 2,
      clarity_threshold: 0.75
    },
    
    // Stage 3 — Generate ×3
    generation: {
      provider: 'groq',
      model: 'openai/gpt-oss-20b', // Specific model ID requested
      count: 3
    },
    
    // Stage 4 — Scoring ×3
    scoring: {
      provider: 'groq',
      model: 'openai/gpt-oss-20b',
      temperature: 0
    },
    
    // Stage 5 — Outcome Runner
    outcomeRunner: {
      provider: 'openai',
      model: 'gpt-4o'
    }
  },

  // 🟣 MODE: PREMIUM (High-Trust / Low-Frequency)
  premium: {
    id: 'premium',
    name: 'Premium',
    description: 'No ambiguity tolerated, maximum trust.',
    
    // Stage 1 — Spec Builder
    specBuilder: {
      provider: 'openai',
      model: 'gpt-4o'
    },
    
    // Stage 2 — Question Engine
    questionEngine: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o',
      mode: 'iterative',
      clarity_threshold: 0.85
    },
    
    // Stage 3 — Generate ×3
    generation: {
      provider: 'groq',
      model: 'qwen/qwen3-32b',
      count: 3
    },
    
    // Stage 4 — Scoring ×3
    scoring: {
      provider: 'groq',
      model: 'qwen/qwen3-32b',
      temperature: 0
    },
    
    // Stage 5 — Outcome Runner
    outcomeRunner: {
      provider: 'openai',
      model: 'gpt-5.2' // Future model placeholder as requested
    }
  }
};

export function getModePolicy(modeId) {
  return MODE_POLICIES[modeId] || MODE_POLICIES.fast;
}
