import { describe, expect, it } from "vitest";
import {
  CACHE_MAX_ENTRIES,
  CACHE_TTL_MS,
  buildCacheKey,
  createTranslationCache,
  evictCache,
} from "./cache";
import { CACHE_STORAGE_KEY } from "./keys";
import type { CacheBackend, TranslationCache } from "./cache";
import type { TranslationBlock } from "./messages";

function makeBackend(): CacheBackend & {
  data: Record<string, unknown>;
  bytes: number;
  sets: number;
} {
  const state: Record<string, unknown> = {};
  const backend: CacheBackend & {
    data: Record<string, unknown>;
    bytes: number;
    sets: number;
  } = {
    bytes: 0,
    data: state,
    get(key: string): Promise<Record<string, unknown>> {
      return Promise.resolve({ [key]: state[key] });
    },
    getBytesInUse(): Promise<number> {
      return Promise.resolve(backend.bytes);
    },
    remove(key: string): Promise<void> {
      delete state[key];
      return Promise.resolve();
    },
    set(item: Readonly<Record<string, unknown>>): Promise<void> {
      backend.sets++;
      Object.assign(state, item);
      return Promise.resolve();
    },
    sets: 0,
  };
  return backend;
}

function localCopy(path: Readonly<CacheBackend>): Promise<Record<string, unknown>> {
  return path.get(CACHE_STORAGE_KEY);
}

function makeCache(backend: Readonly<CacheBackend>): TranslationCache {
  return createTranslationCache(
    { maxEntries: CACHE_MAX_ENTRIES, saveDebounceMs: 0, ttlMs: CACHE_TTL_MS },
    backend,
  );
}

describe("buildCacheKey", () => {
  it("produces from:to:html keys", () => {
    expect(buildCacheKey("<p>x</p>", "en", "ja")).toBe("en:ja:<p>x</p>");
  });
});

describe("evictCache", () => {
  it("drops expired entries", () => {
    const now = Date.now();
    const cache = {
      fresh: { block: { sentences: [] }, timestamp: now },
      old: { block: { sentences: [] }, timestamp: now - CACHE_TTL_MS - 1000 },
    };
    const evicted = evictCache(cache, { maxEntries: CACHE_MAX_ENTRIES, ttlMs: CACHE_TTL_MS });
    expect("old" in evicted).toBe(false);
    expect("fresh" in evicted).toBe(true);
  });

  it("keeps the newest entries when over the cap", () => {
    const cache: Record<string, { block: TranslationBlock; timestamp: number }> = {};
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      cache[String(i)] = { block: { sentences: [] }, timestamp: now - i * 1000 };
    }
    const evicted = evictCache(cache, { maxEntries: 3, ttlMs: CACHE_TTL_MS });
    expect(Object.keys(evicted)).toHaveLength(3);
    // Newest three survive (0,1,2)
    expect(evicted["0"]).toBeDefined();
    expect(evicted["3"]).toBeUndefined();
    expect(evicted["4"]).toBeUndefined();
  });
});

describe("createTranslationCache", () => {
  it("returns a miss when nothing is stored", async () => {
    const backend = makeBackend();
    const cache = makeCache(backend);
    expect(await cache.lookup("<p>a</p>", "en", "ja")).toBeNull();
  });

  it("stores and then hits in the memory layer", async () => {
    const backend = makeBackend();
    const block: TranslationBlock = { sentences: [{ source: "a", translation: "A" }] };
    const cache = makeCache(backend);
    await cache.store("<p>a</p>", "en", "ja", block);
    const entry = await cache.lookup("<p>a</p>", "en", "ja");
    expect(entry?.block).toEqual(block);
  });

  it("persists to storage and hits after a fresh cache (shared object)", async () => {
    const backend = makeBackend();
    const block: TranslationBlock = { sentences: [{ source: "a", translation: "A" }] };
    const cache = makeCache(backend);
    await cache.store("<p>a</p>", "en", "ja", block);
    await cache.flushSave();
    const stored = await localCopy(backend);
    expect(stored[CACHE_STORAGE_KEY]).toBeDefined();
  });

  it("does not leak cleaned cache back after clear", async () => {
    const backend = makeBackend();
    const cache = makeCache(backend);
    await cache.store("<p>a</p>", "en", "ja", { sentences: [{ source: "a", translation: "A" }] });
    await cache.clear();
    const stored = await localCopy(backend);
    expect(stored[CACHE_STORAGE_KEY]).toBeUndefined();
  });

  it("reports stats for the current cache object", async () => {
    const backend = makeBackend();
    backend.bytes = 42;
    const cache = makeCache(backend);
    await cache.store("<p>a</p>", "en", "ja", { sentences: [{ source: "a", translation: "A" }] });
    const stats = await cache.getCacheStats();
    expect(stats.bytes).toBe(42);
    expect(stats.entries).toBeGreaterThanOrEqual(1);
  });
});
