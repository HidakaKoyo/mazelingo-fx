import { buildLocalEndpointUrl, LOCAL_REQUEST_TIMEOUT_MS } from "./local-endpoint";
import type { LocalEndpointConfig } from "./local-endpoint";
import type { IndexedBlock, Language, TranslationBlock } from "./messages";
import { plainText, splitHtmlSentences } from "./plamo-segment";

const MAX_CONCURRENT_REQUESTS = 8;
const MAX_CONTEXT_CHARS = 500;
const MAX_OUTPUT_TOKENS = 4096;
const RESERVED_TOKEN_RE = /<\|plamo:[^>]*(?:>|$)/gu;

interface CompletionResponse {
  readonly choices?: readonly Readonly<{ text?: unknown }>[];
}

interface Limiter {
  active: number;
  readonly waiting: Array<() => void>;
}

export interface PlamoConfig {
  readonly localEndpoint: Readonly<LocalEndpointConfig>;
  readonly plamoModel: string;
}

const limiters = new Map<string, Limiter>();

function sanitizePromptValue(value: string): string {
  return value.replaceAll(RESERVED_TOKEN_RE, "");
}

export function buildPfml3Prompt(
  text: string,
  sourceLanguage: Language,
  targetLanguage: Language,
  context = "",
): string {
  const cleanText = sanitizePromptValue(text);
  const cleanContext = sanitizePromptValue(context);
  return (
    "<|plamo:tag|>dataset<|plamo:msg|>translation" +
    (cleanContext === "" ? "" : `<|plamo:tag|>context<|plamo:msg|>${cleanContext}`) +
    `<|plamo:tag|>input<|plamo:key|>lang<|plamo:val|>${sourceLanguage}<|plamo:msg|>${cleanText}` +
    `<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>${targetLanguage}<|plamo:msg|>`
  );
}

function outputTokenLimit(text: string): number {
  return Math.min(MAX_OUTPUT_TOKENS, Math.max(64, Array.from(text).length * 2));
}

async function withEndpointLimit<T>(endpoint: string, task: () => Promise<T>): Promise<T> {
  const limiter = limiters.get(endpoint) ?? { active: 0, waiting: [] };
  limiters.set(endpoint, limiter);
  if (limiter.active >= MAX_CONCURRENT_REQUESTS) {
    await new Promise<void>((resolve) => {
      limiter.waiting.push(resolve);
    });
  } else {
    limiter.active += 1;
  }
  try {
    return await task();
  } finally {
    const next = limiter.waiting.shift();
    if (next === undefined) {
      limiter.active -= 1;
    } else {
      next();
    }
    if (limiter.active === 0 && limiter.waiting.length === 0) limiters.delete(endpoint);
  }
}

function fetchCompletion(
  endpoint: string,
  model: string,
  prompt: string,
  text: string,
  apiKey: string,
): Promise<string> {
  return withEndpointLimit(endpoint, async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, LOCAL_REQUEST_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey !== "") headers.Authorization = `Bearer ${apiKey}`;
      const response = await fetch(endpoint, {
        body: JSON.stringify({
          max_tokens: outputTokenLimit(text),
          model,
          prompt,
          stop: ["<|plamo:tag|>", "<|plamo:bos|>"],
          temperature: 0,
        }),
        headers,
        method: "POST",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`PLaMo request failed (${response.status})`);
      const data: unknown = await response.json();
      const parsed = typeof data === "object" && data !== null ? (data as CompletionResponse) : {};
      const translation = parsed.choices?.[0]?.text;
      if (typeof translation !== "string" || translation.trim() === "") {
        throw new Error("PLaMo returned no translation");
      }
      return translation.trim();
    } finally {
      clearTimeout(timeout);
    }
  });
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function translateUnit(
  source: string,
  context: string,
  from: Language,
  to: Language,
  endpoint: string,
  config: Readonly<PlamoConfig>,
): Promise<Readonly<{ source: string; translation: string }>> {
  const text = plainText(source);
  const prompt = buildPfml3Prompt(text, from, to, context);
  const translation = await fetchCompletion(
    endpoint,
    config.plamoModel,
    prompt,
    text,
    config.localEndpoint.apiKey,
  );
  return { source, translation: escapeHtml(translation) };
}

async function translateBlock(
  html: string,
  from: Language,
  to: Language,
  endpoint: string,
  config: Readonly<PlamoConfig>,
): Promise<TranslationBlock | null> {
  const sources = splitHtmlSentences(html, from);
  if (sources.length === 0) return null;
  let previous = "";
  const tasks = sources.map((source) => {
    const context = previous.slice(-MAX_CONTEXT_CHARS);
    previous += plainText(source);
    return translateUnit(source, context, from, to, endpoint, config);
  });
  try {
    return { sentences: await Promise.all(tasks) };
  } catch {
    try {
      return { sentences: [await translateUnit(html, "", from, to, endpoint, config)] };
    } catch {
      return null;
    }
  }
}

export function translatePlamoUncached(
  blocks: readonly Readonly<IndexedBlock>[],
  from: Language,
  to: Language,
  config: Readonly<PlamoConfig>,
): Promise<readonly (TranslationBlock | null)[]> {
  const endpoint = buildLocalEndpointUrl(config.localEndpoint.baseUrl, "/completions");
  if (endpoint === null) return Promise.resolve(blocks.map(() => null));
  return Promise.all(blocks.map((block) => translateBlock(block.html, from, to, endpoint, config)));
}
