export const DEFAULT_CONFIG = {
  enabled: true,
  models: ["gpt-5.2"],
  apiKeys: {},
  pageListInclude: "https://*",
  pageListExclude: "",
  mixLanguage: true,
  englishRatio: 30,
  translateButtons: false,
  minTextLength: 2,
  outputRatio: 20,
  ttsVoice: "nova",
};

export function mergeConfig(raw) {
  const safe = raw || {};
  let models = safe.models;
  if (!Array.isArray(models)) {
    models = DEFAULT_CONFIG.models;
  }
  const merged = {
    ...DEFAULT_CONFIG,
    ...safe,
    models,
    apiKeys: { ...DEFAULT_CONFIG.apiKeys, ...(safe.apiKeys || {}) },
  };
  delete merged.providerId;
  delete merged.apiKey;
  delete merged.providerOptions;
  return merged;
}
