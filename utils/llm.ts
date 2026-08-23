/**
 * LLM request sending and model-chain fallback.
 *
 * This layer owns the `fetch` calls and the sequential model fallback. The
 * provider-specific builders/parsers and the registry live in `llm-providers.ts`
 * (re-exported here) to keep each module within the linter's line budget.
 *
 * Pure module — no chrome.* APIs, no DOM.
 */
import {
  buildLLMRequest,
  parseAnthropicResponse,
  parseGoogleResponse,
  parseOpenAIResponse,
  resolveProvider,
} from "./llm-providers";
import type { ResolvedProvider } from "./llm-providers";
import type { ChatMessage, ProviderEntry } from "./llm-registry";

export { LLM_REGISTRY, TRANSLATION_SCHEMA } from "./llm-registry";
export { resolveProvider } from "./llm-providers";
export type { ChatMessage } from "./llm-registry";

const FORMAT_HANDLERS: Record<ProviderEntry["format"], { parse: (data: unknown) => unknown }> = {
  anthropic: { parse: parseAnthropicResponse },
  google: { parse: parseGoogleResponse },
  openai: { parse: parseOpenAIResponse },
};

export async function callLLM(
  provider: Readonly<ResolvedProvider>,
  modelName: string,
  messages: readonly ChatMessage[],
  apiKey: string,
  schema?: unknown,
): Promise<unknown> {
  const handler = FORMAT_HANDLERS[provider.entry.format];
  if (handler === undefined) {
    throw new Error(`No handler for provider format: ${provider.entry.format}`);
  }
  const { url, options } = buildLLMRequest(provider, modelName, messages, apiKey, schema);

  console.log(`[mlg:llm] calling ${modelName} (${provider.entry.format}) ${url}`);
  const startTime = performance.now();
  const response = await fetch(url, options);
  const elapsed = Math.round(performance.now() - startTime);
  if (!response.ok) {
    const text = await response.text();
    console.error(`[mlg:llm] ${modelName} failed (${response.status}) [${elapsed}ms]`);
    const apiMessage = parseErrorMessage(text);
    const detail =
      apiMessage === null ? "Provider returned an error" : redactSecret(apiMessage, apiKey);
    throw new Error(`LLM request failed (${response.status}): ${detail}`);
  }

  const data: unknown = await response.json();
  console.log(`[mlg:llm] ${modelName} succeeded [${elapsed}ms]`);
  return handler.parse(data);
}

function redactSecret(message: string, secret: string): string {
  return secret === "" ? message : message.replaceAll(secret, "[REDACTED]");
}

function wrapError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Build a sequential fallback chain over the keyed models. Each model runs
 * only if the previous one rejected; the first success resolves the chain.
 */
function buildFallbackChain(
  models: readonly string[],
  messages: readonly ChatMessage[],
  apiKeys: Readonly<Record<string, string>>,
  schema?: unknown,
): { chain: Promise<unknown>; errors: Error[] } {
  const errors: Error[] = [];
  let chain: Promise<unknown> = Promise.reject(
    new Error("No API keys available for any of the specified models"),
  );
  for (const modelName of models) {
    const provider = resolveProvider(modelName);
    if (!provider) {
      console.warn(`[mlg:llm] no provider for model: ${modelName}`);
      errors.push(new Error(`No provider found for model: ${modelName}`));
      continue;
    }
    const apiKeyKey = provider.entry.apiKeyKey ?? provider.prefix;
    const apiKey = apiKeys[apiKeyKey];
    if (apiKey === undefined) {
      console.log(`[mlg:llm] skipping ${modelName} (no API key for "${provider.prefix}")`);
      continue;
    }
    chain = chain.catch(() =>
      callLLM(provider, modelName, messages, apiKey, schema)
        .then((result) => {
          console.log(`[mlg:llm] ${modelName} succeeded`);
          return result;
        })
        .catch((error: unknown) => {
          const wrapped = wrapError(error);
          console.error(`[mlg:llm] ${modelName} failed:`, wrapped.message);
          errors.push(wrapped);
          throw wrapped;
        }),
    );
  }
  return { chain, errors };
}

export function callLLMChain(
  models: readonly string[],
  messages: readonly ChatMessage[],
  apiKeys: Readonly<Record<string, string>>,
  schema?: unknown,
): Promise<unknown> {
  const { chain, errors } = buildFallbackChain(models, messages, apiKeys, schema);

  // If every keyed model rejected, surface an aggregated error.
  return chain.catch(() => {
    if (errors.length > 0) {
      throw new Error(
        `All models failed:\n${errors.map((e: Readonly<Error>) => e.message).join("\n")}`,
      );
    }
    throw new Error("No API keys available for any of the specified models");
  });
}

interface ApiErrorShape {
  error?: { message?: unknown };
}

function isApiErrorShape(value: unknown): value is ApiErrorShape {
  return typeof value === "object" && value !== null;
}

function parseErrorMessage(text: string): string | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (isApiErrorShape(parsed) && isApiErrorShape(parsed.error)) {
      const message = parsed.error.message;
      if (typeof message === "string") {
        return message;
      }
    }
  } catch {
    // Not JSON — the caller keeps the raw text.
  }
  return null;
}
