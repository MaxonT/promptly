export const INFERENCE_PROFILES = {
  fast: {
    id: "fast",
    label: "Fast",
    stages: {
      agentA: {
        provider: "groq",
        envKey: "GROQ_API_KEY",
        model: "llama-3.1-8b-instant",
        maxTokens: 180,
        temperature: 0.3
      },
      agentB: {
        provider: "groq",
        envKey: "GROQ_API_KEY",
        model: "llama-3.1-8b-instant",
        maxTokens: 120,
        temperature: 0.2
      },
      agentC: {
        provider: "groq",
        envKey: "GROQ_API_KEY",
        model: "openai/gpt-oss-20b",
        maxTokens: 600,
        temperature: 0.3
      }
    }
  },
  deep: {
    id: "deep",
    label: "Deep",
    stages: {
      agentA: {
        provider: "groq",
        envKey: "GROQ_API_KEY",
        model: "llama-3.1-8b-instant",
        maxTokens: 250,
        temperature: 0.4
      },
      agentB: {
        provider: "groq",
        envKey: "GROQ_API_KEY",
        model: "openai/gpt-oss-20b",
        maxTokens: 220,
        temperature: 0.3
      },
      agentC: {
        provider: "groq",
        envKey: "GROQ_API_KEY",
        model: "qwen/qwen3-32b",
        maxTokens: 900,
        temperature: 0.35
      }
    }
  },
  ultra: {
    id: "ultra",
    label: "Ultra",
    stages: {
      agentA: {
        provider: "groq",
        envKey: "GROQ_API_KEY",
        model: "openai/gpt-oss-20b",
        maxTokens: 350,
        temperature: 0.4
      },
      agentB: {
        provider: "groq",
        envKey: "GROQ_API_KEY",
        model: "qwen/qwen3-32b",
        maxTokens: 300,
        temperature: 0.35
      },
      agentC: {
        provider: "groq",
        envKey: "GROQ_API_KEY",
        model: "qwen/qwen3-32b",
        maxTokens: 1400,
        temperature: 0.4
      }
    }
  }
};
