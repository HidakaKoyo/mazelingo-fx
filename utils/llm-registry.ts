/**
 * Provider registry, the structured-output schema, and the shared request /
 * message types. Split from the request/builders module so each file stays
 * within the linter's line budget.
 */
export interface ProviderEntry {
  readonly baseUrl: string;
  readonly format: "openai" | "anthropic" | "google";
  readonly apiKeyKey?: string;
  readonly stripPrefix?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

export const LLM_REGISTRY: Record<string, ProviderEntry> = {
  claude: {
    baseUrl: "https://api.anthropic.com/v1/messages",
    format: "anthropic",
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com/chat/completions",
    format: "openai",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    format: "google",
  },
  glm: {
    baseUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    format: "openai",
  },
  gpt: {
    baseUrl: "https://api.openai.com/v1/chat/completions",
    format: "openai",
  },
  o: {
    apiKeyKey: "gpt",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    format: "openai",
  },
  "openrouter/": {
    apiKeyKey: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    format: "openai",
    headers: {
      "HTTP-Referer":
        "https://chromewebstore.google.com/detail/mazelingo/bhdngeocokoeblnnlhjibojcadefimpi",
      "X-OpenRouter-Title": "Mazelingo",
    },
    stripPrefix: "openrouter/",
  },
};

export const TRANSLATION_SCHEMA = {
  additionalProperties: false,
  properties: {
    blocks: {
      items: {
        additionalProperties: false,
        properties: {
          i: { type: "integer" },
          sentences: {
            items: {
              additionalProperties: false,
              properties: {
                source: { type: "string" },
                translation: { type: "string" },
              },
              required: ["source", "translation"],
              type: "object",
            },
            type: "array",
          },
        },
        required: ["i", "sentences"],
        type: "object",
      },
      type: "array",
    },
  },
  required: ["blocks"],
  type: "object",
} as const;

export interface ChatMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface LLMRequest {
  url: string;
  options: {
    method: string;
    headers: Record<string, string>;
    body: string;
  };
}
