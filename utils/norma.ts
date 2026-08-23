/**
 * Norma cache — tracks which output blocks have been fully completed so the
 * content script doesn't re-send them. Persisted to chrome.storage with TTL +
 * cap eviction.
 */
import { NORMA_CACHE_KEY } from "./keys";
import { evictEntries } from "./evict";

export interface NormaBackend {
  get(key: Readonly<string>): Promise<Record<string, unknown>>;
  set(item: Readonly<Record<string, unknown>>): Promise<void>;
}

export interface NormaTtlConfig {
  ttlMs: number;
  maxEntries: number;
}

// 30 days
export const NORMA_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const NORMA_MAX_ENTRIES = 500;

export function evictNorma(
  cache: Readonly<Record<string, Readonly<{ timestamp: number }>>>,
): Record<string, { timestamp: number }> {
  return evictEntries(cache, NORMA_TTL_MS, NORMA_MAX_ENTRIES);
}

export function createNormaCache(backend: Readonly<NormaBackend>): {
  markNormaDone: (textKey: string) => Promise<void>;
  checkNormaDone: (textKeys: readonly string[]) => Promise<Record<string, boolean>>;
} {
  async function get(): Promise<Record<string, { timestamp: number }>> {
    const result = await backend.get(NORMA_CACHE_KEY);
    const stored = result[NORMA_CACHE_KEY];
    return isNormaCache(stored) ? stored : {};
  }

  async function markNormaDone(textKey: string): Promise<void> {
    const cache = await get();
    cache[textKey] = { timestamp: Date.now() };
    await backend.set({ [NORMA_CACHE_KEY]: evictEntries(cache, NORMA_TTL_MS, NORMA_MAX_ENTRIES) });
  }

  async function checkNormaDone(textKeys: readonly string[]): Promise<Record<string, boolean>> {
    const cache = await get();
    const now = Date.now();
    const result: Record<string, boolean> = {};
    for (const key of textKeys) {
      const entry = cache[key];
      result[key] = Boolean(entry && now - entry.timestamp < NORMA_TTL_MS);
    }
    return result;
  }

  return { checkNormaDone, markNormaDone };
}

function isNormaCache(value: unknown): value is Record<string, { timestamp: number }> {
  return typeof value === "object" && value !== null;
}
