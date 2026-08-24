/**
 * Model catalog for test_models.js: model lists per provider.
 * Model list sourced from each provider's /models API.
 */
/**
 * @typedef {{
 *   readonly apiKeyEnv: string, readonly baseUrl: string,
 *   readonly format: "anthropic" | "google" | "openai", readonly models: string[],
 * }} ProviderConfig
 */
/** @type {Record<string, ProviderConfig>} */
export const MODELS = {
  claude: {
    apiKeyEnv: "CLAUDE_API_KEY",
    baseUrl: "https://api.anthropic.com/v1/messages",
    format: "anthropic",
    models: [
      "claude-sonnet-4-6",
      "claude-sonnet-4-5-20250929",
      "claude-sonnet-4-20250514",
      "claude-opus-4-6",
      "claude-opus-4-5-20251101",
      "claude-opus-4-1-20250805",
      "claude-opus-4-20250514",
      "claude-haiku-4-5-20251001",
      "claude-3-haiku-20240307",
    ],
  },
  gemini: {
    apiKeyEnv: "GEMINI_API_KEY",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    format: "google",
    models: [
      "gemini-2.0-flash",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-2.5-pro",
      "gemini-3-flash-preview",
      "gemini-3.1-flash-lite-preview",
      "gemini-3.1-pro-preview",
    ],
  },
  glm: {
    apiKeyEnv: "GLM_API_KEY",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    format: "openai",
    models: ["glm-4.5", "glm-4.5-air", "glm-4.6", "glm-4.7", "glm-5", "glm-5-turbo"],
  },
  gpt: {
    apiKeyEnv: "GPT_API_KEY",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    format: "openai",
    models: [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
      "gpt-5",
      "gpt-5-mini",
      "gpt-5-nano",
      "gpt-5-pro",
      "gpt-5.1",
      "gpt-5.2",
      "gpt-5.2-pro",
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.4-nano",
      "gpt-5.4-pro",
      "o1",
      "o1-pro",
      "o3",
      "o3-mini",
      "o4-mini",
    ],
  },
};
