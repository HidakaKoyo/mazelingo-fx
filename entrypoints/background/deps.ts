import { browser } from "wxt/browser";
import { mergeConfig } from "@/utils/config";
import type { Config } from "@/utils/config";
import { CACHE_MAX_ENTRIES, CACHE_TTL_MS, createTranslationCache } from "@/utils/cache";
import type { CacheBackend } from "@/utils/cache";
import { createVocabStore } from "@/utils/vocab";
import type { VocabBackend } from "@/utils/vocab";
import { createNormaCache } from "@/utils/norma";
import { createExplanationStore } from "@/utils/explanation";
import { STORAGE_KEY } from "@/utils/keys";
import type { TtsPayload } from "@/utils/messages";

interface URLLoader {
  getURL(path: string): string;
}

function isConfig(value: unknown): value is Config {
  return typeof value === "object" && value !== null;
}

function isURLLoader(value: unknown): value is URLLoader {
  return typeof value === "object" && value !== null;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createStorageBackend(): CacheBackend {
  return {
    get: (key: string): Promise<Record<string, unknown>> => browser.storage.local.get(key),
    getBytesInUse: (key: string): Promise<number> => browser.storage.local.getBytesInUse(key),
    remove: (key: string): Promise<void> => browser.storage.local.remove(key),
    set: (item: Readonly<Record<string, unknown>>): Promise<void> =>
      browser.storage.local.set(item),
  };
}

function createVocabBackend(): VocabBackend {
  const loader: unknown = browser.runtime;
  return {
    fetch: (url: string): Promise<Response> => fetch(url),
    get: (key: string): Promise<Record<string, unknown>> => browser.storage.local.get(key),
    getURL: (path: string): string => (isURLLoader(loader) ? loader.getURL(path) : path),
    set: (item: Readonly<Record<string, unknown>>): Promise<void> =>
      browser.storage.local.set(item),
  };
}

const storageBackend = createStorageBackend();
const vocabBackend = createVocabBackend();
export const cache = createTranslationCache(
  { maxEntries: CACHE_MAX_ENTRIES, ttlMs: CACHE_TTL_MS },
  storageBackend,
);
export const explanationStore = createExplanationStore(storageBackend);
export const norma = createNormaCache(storageBackend);
export const vocabStore = createVocabStore(vocabBackend);

export async function loadConfig(): Promise<Config> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return mergeConfig(isConfig(result[STORAGE_KEY]) ? result[STORAGE_KEY] : undefined);
}

export async function setConfig(patch: Readonly<Record<string, unknown>>): Promise<Config> {
  const current = await loadConfig();
  const next = mergeConfig({ ...current, ...patch });
  await browser.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

function buildAudioRequest(payload: Readonly<TtsPayload>, apiKey: string): RequestInit {
  const voice = payload.voice === undefined || payload.voice === "" ? "nova" : payload.voice;
  return {
    body: JSON.stringify({ model: "tts-1", input: payload.text, voice }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  };
}

export async function tts(
  payload: Readonly<TtsPayload>,
): Promise<{ dataUrl?: string; error?: string }> {
  try {
    const config = await loadConfig();
    const apiKey = config.apiKeys.gpt;
    if (apiKey === undefined) {
      throw new Error("No OpenAI API key configured");
    }
    const response = await fetch(
      "https://api.openai.com/v1/audio/speech",
      buildAudioRequest(payload, apiKey),
    );
    if (!response.ok) {
      throw new Error(`TTS failed (${response.status})`);
    }
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      if (byte !== undefined) {
        binary += String.fromCodePoint(byte);
      }
    }
    const base64 = btoa(binary);
    return { dataUrl: `data:audio/mpeg;base64,${base64}` };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}
