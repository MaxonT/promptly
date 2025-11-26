export function getPublicSettings() {
  const llmEnabled = Boolean(process.env.OPENAI_API_KEY);
  const defaultModel =
    process.env.OPENAI_MODEL || process.env.OPENAI_API_MODEL || "gpt-4.1-mini";
  const outcomeModel = process.env.OUTCOME_MODEL || null;

  return {
    env: process.env.NODE_ENV || "development",
    llmEnabled,
    defaultModel,
    outcomeModel,
    maxCandidates: 8,
    features: {
      questionWizard: true,
      promptEnhancer: true,
      outcomeRunner: true
    }
  };
}