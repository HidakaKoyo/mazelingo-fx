export const CUSTOM_MODEL_VALUE = "__custom__";

export type ModelOption = string | { label: { en: string; ja: string }; value: string };

export const MODEL_OPTIONS: readonly ModelOption[] = [
  { label: { en: "(none)", ja: "（なし）" }, value: "" },
  // GLM
  "glm-4.5",
  "glm-4.5-air",
  "glm-4.6",
  "glm-4.7",
  "glm-5",
  "glm-5-turbo",
  // GPT
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-5.1",
  "gpt-5.2",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.4-nano",
  "o1",
  "o3",
  "o3-mini",
  "o4-mini",
  // Claude
  "claude-sonnet-4-6",
  "claude-sonnet-4-5-20250929",
  "claude-sonnet-4-20250514",
  "claude-opus-4-6",
  "claude-opus-4-5-20251101",
  "claude-opus-4-1-20250805",
  "claude-opus-4-20250514",
  "claude-haiku-4-5-20251001",
  "claude-3-haiku-20240307",
  // Gemini
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-3.1-pro-preview",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  // OpenRouter
  "openrouter/openai/gpt-4.1-mini",
  "openrouter/google/gemini-2.5-flash",
  "openrouter/deepseek/deepseek-chat",
  "openrouter/anthropic/claude-haiku-4.5",
  { label: { en: "Custom…", ja: "カスタム…" }, value: CUSTOM_MODEL_VALUE },
];

export const TTS_VOICES: readonly { label: string; value: string }[] = [
  { label: "Alloy", value: "alloy" },
  { label: "Ash", value: "ash" },
  { label: "Coral", value: "coral" },
  { label: "Echo", value: "echo" },
  { label: "Fable", value: "fable" },
  { label: "Nova", value: "nova" },
  { label: "Onyx", value: "onyx" },
  { label: "Sage", value: "sage" },
  { label: "Shimmer", value: "shimmer" },
];

export const SAVE_ANIMATION_DURATION_MS = 700;
export const SAVE_ANIMATION_INTERVAL_MS = 1500;
