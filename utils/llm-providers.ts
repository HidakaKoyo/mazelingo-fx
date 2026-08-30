/**
 * LLM provider-specific request building and response parsing.
 *
 * Kept separate from `llm.ts` (the fetch layer) so each module stays under the
 * linter's line budget. Pure module — no chrome.* APIs, no DOM.
 */
import { LLM_REGISTRY } from "./llm-registry";
import type { ChatMessage, LLMRequest, ProviderEntry } from "./llm-registry";

export { LLM_REGISTRY, TRANSLATION_SCHEMA } from "./llm-registry";

interface FormatHandler {
  build: (
    modelName: string,
    messages: readonly ChatMessage[],
    apiKey: string,
    baseUrl: string,
    schema: unknown,
    extraHeaders?: Readonly<Record<string, string>>,
    structuredOutputRouting?: ProviderEntry["structuredOutputRouting"],
  ) => LLMRequest;
  parse: (data: unknown) => unknown;
}

interface OpenAIResponse {
  choices: { message: { content: string } }[];
}

interface AnthropicResponse {
  content: { type: string; text?: string }[];
}

interface GeminiResponse {
  error?: { message?: string };
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

interface ErrorResponse {
  error?: { message?: string };
}

function isOpenAIResponse(value: unknown): value is OpenAIResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "choices" in value &&
    Array.isArray(value.choices)
  );
}

function isAnthropicResponse(value: unknown): value is AnthropicResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "content" in value &&
    Array.isArray(value.content)
  );
}

function isGeminiResponse(value: unknown): value is GeminiResponse {
  return typeof value === "object" && value !== null;
}

export function isErrorResponse(value: unknown): value is ErrorResponse {
  return typeof value === "object" && value !== null;
}

/**
 * Match a model name to a provider by longest registry prefix, so "gpt-4.1"
 * resolves before "gpt" would incorrectly shadow it.
 */
export interface ResolvedProvider {
  readonly entry: ProviderEntry;
  readonly prefix: string;
}

export function resolveProvider(modelName: string): ResolvedProvider | null {
  const prefixes = Object.keys(LLM_REGISTRY).toSorted((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    const entry = LLM_REGISTRY[prefix];
    if (modelName.startsWith(prefix) && entry) {
      return { entry, prefix };
    }
  }
  return null;
}

function stripMarkdownCodeBlock(text: string): string {
  const match = /^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/u.exec(text);
  return match ? (match[1] ?? "") : text;
}

// --- OpenAI compatible (GLM, GPT, DeepSeek) ---

function buildOpenAIRequest(
  modelName: string,
  messages: readonly ChatMessage[],
  apiKey: string,
  baseUrl: string,
  schema: unknown,
  extraHeaders: Readonly<Record<string, string>> = {},
  structuredOutputRouting: ProviderEntry["structuredOutputRouting"],
): LLMRequest {
  const body: Record<string, unknown> = { messages, model: modelName };
  if (schema !== undefined) {
    body.response_format = {
      json_schema: { name: "response", schema, strict: true },
      type: "json_schema",
    };
    if (structuredOutputRouting?.requireParameters === true) {
      body.provider = { require_parameters: true };
    }
  }
  return {
    options: {
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...extraHeaders,
      },
      method: "POST",
    },
    url: baseUrl,
  };
}

export function parseOpenAIResponse(data: unknown): unknown {
  if (!isOpenAIResponse(data)) {
    throw new TypeError("OpenAI API returned an unexpected response shape");
  }
  const content = data.choices[0]?.message.content;
  if (typeof content !== "string") {
    throw new TypeError("OpenAI API returned no message content");
  }
  return JSON.parse(stripMarkdownCodeBlock(content));
}

// --- Anthropic (Claude) ---

function buildAnthropicRequest(
  modelName: string,
  messages: readonly ChatMessage[],
  apiKey: string,
  baseUrl: string,
  _schema: unknown,
  _extraHeaders?: Readonly<Record<string, string>>,
  _structuredOutputRouting?: ProviderEntry["structuredOutputRouting"],
): LLMRequest {
  const systemMsg = messages.find((m: Readonly<ChatMessage>) => m.role === "system");
  const nonSystemMessages = messages.filter((m: Readonly<ChatMessage>) => m.role !== "system");
  // Add prefill to force JSON output without markdown
  const messagesWithPrefill: ChatMessage[] = [
    ...nonSystemMessages,
    { content: "{", role: "assistant" },
  ];
  const body: Record<string, unknown> = {
    max_tokens: 16384,
    messages: messagesWithPrefill,
    model: modelName,
  };
  if (systemMsg) {
    body.system = `${systemMsg.content}\n\nRespond with ONLY valid JSON. No markdown, no code blocks, no explanation.`;
  }
  return {
    options: {
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        "anthropic-dangerous-direct-browser-access": "true",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      },
      method: "POST",
    },
    url: baseUrl,
  };
}

export function parseAnthropicResponse(data: unknown): unknown {
  if (!isAnthropicResponse(data)) {
    throw new TypeError("Anthropic API returned an unexpected response shape");
  }
  const textBlock = data.content.find(
    (b: Readonly<{ type: string; text?: string }>) => b.type === "text",
  );
  const raw = textBlock?.text ?? "";
  // Prepend "{" from prefill since Anthropic continues from it
  return JSON.parse(`{${stripMarkdownCodeBlock(raw)}`);
}

// --- Google (Gemini) ---

function buildGoogleRequest(
  modelName: string,
  messages: readonly ChatMessage[],
  apiKey: string,
  baseUrl: string,
  schema: unknown,
  _extraHeaders?: Readonly<Record<string, string>>,
  _structuredOutputRouting?: ProviderEntry["structuredOutputRouting"],
): LLMRequest {
  const systemMsg = messages.find((m: Readonly<ChatMessage>) => m.role === "system");
  const nonSystemMessages = messages.filter((m: Readonly<ChatMessage>) => m.role !== "system");
  const contents = nonSystemMessages.map((m) => ({
    parts: [{ text: m.content }],
    role: m.role === "assistant" ? "model" : "user",
  }));
  const textFormat: Record<string, unknown> = { mimeType: "APPLICATION_JSON" };
  if (schema !== undefined) {
    textFormat.schema = schema;
  }
  const generationConfig = { responseFormat: { text: textFormat } };
  const body: Record<string, unknown> = { contents, generationConfig };
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }
  return {
    options: {
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      method: "POST",
    },
    url: `${baseUrl}/models/${modelName}:generateContent`,
  };
}

export function parseGoogleResponse(data: unknown): unknown {
  if (!isGeminiResponse(data)) {
    throw new TypeError("Gemini API returned an unexpected response shape");
  }
  if (data.error?.message !== undefined) {
    throw new Error(`Gemini API error: ${data.error.message}`);
  }
  const parts = data.candidates?.[0]?.content?.parts;
  const textPart = Array.isArray(parts)
    ? parts.find((part: Readonly<{ text?: string }>) => typeof part?.text === "string")
    : null;
  if (!textPart || typeof textPart.text !== "string") {
    throw new TypeError("Gemini API returned no text candidate");
  }
  return JSON.parse(stripMarkdownCodeBlock(textPart.text));
}

// --- Format handler registry ---

const FORMAT_HANDLERS: Record<ProviderEntry["format"], FormatHandler> = {
  anthropic: { build: buildAnthropicRequest, parse: parseAnthropicResponse },
  google: { build: buildGoogleRequest, parse: parseGoogleResponse },
  openai: { build: buildOpenAIRequest, parse: parseOpenAIResponse },
};

export function buildLLMRequest(
  provider: Readonly<ResolvedProvider>,
  modelName: string,
  messages: readonly ChatMessage[],
  apiKey: string,
  schema: unknown,
): LLMRequest {
  const handler = FORMAT_HANDLERS[provider.entry.format];
  const stripPrefix = provider.entry.stripPrefix;
  const requestModelName =
    stripPrefix === undefined ? modelName : modelName.slice(stripPrefix.length);
  return handler.build(
    requestModelName,
    messages,
    apiKey,
    provider.entry.baseUrl,
    schema,
    provider.entry.headers,
    provider.entry.structuredOutputRouting,
  );
}

/**
 * Parse an LLM response, throwing a descriptive error when the API rejected
 * the request with a JSON `{ error: { message } }` body.
 */
export function parseLLMErrorResponse(text: string): string | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (isErrorResponse(parsed) && parsed.error?.message !== undefined) {
      return parsed.error.message;
    }
  } catch {
    // Not JSON — the caller keeps the raw text.
  }
  return null;
}
