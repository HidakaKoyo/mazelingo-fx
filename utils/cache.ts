/**
 * Translation cache — two layers: in-memory Map + persistent chrome.storage.
 *
 * The persistent layer keeps a single shared object per worker lifetime and
 * serializes/denounces writes, so concurrent batches don't clobber each other
 * (the historical last-writer-wins bug). Storage access is injected so this
 * module can be tested with an in-memory fake instead of chrome.* mocks.
 *
 * The cache entry shape is `{ block, timestamp }` where `block` is the rounded
 * `TranslationBlock` (sentences only).
 */
import { CACHE_STORAGE_KEY } from "./keys";
import { evictEntries } from "./evict";
import type { TranslationBlock } from "./messages";

export interface CacheEntry {
  block: TranslationBlock;
  timestamp: number;
}

export interface CacheBackend {
  get(key: string): Promise<Record<string, unknown>>;
  set(item: Readonly<Record<string, unknown>>): Promise<void>;
  remove(key: string): Promise<void>;
  getBytesInUse(key: string): Promise<number>;
}

export interface CacheConfig {
  ttlMs: number;
  maxEntries: number;
  /** Debounce window for persistent writes (0 flushes immediately). */
  saveDebounceMs?: number;
}

// 7 days
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const CACHE_MAX_ENTRIES = 1000;

export function buildCacheKey(html: string, from: string, to: string): string {
  return `${from}:${to}:${html}`;
}

/**
 * Eviction: drop expired entries, then trim oldest beyond maxEntries.
 */
export function evictCache<T extends CacheEntry>(
  cache: Readonly<Record<string, T>>,
  cfg: Readonly<Pick<CacheConfig, "ttlMs" | "maxEntries">>,
): Record<string, T> {
  return evictEntries(cache, cfg.ttlMs, cfg.maxEntries);
}

export interface TranslationCache {
  getCacheStats(): Promise<{ entries: number; bytes: number }>;
  clear(): Promise<void>;
  lookup(html: string, from: string, to: string): Promise<CacheEntry | null>;
  store(
    html: string,
    from: string,
    to: string,
    block: DeepReadonly<TranslationBlock>,
  ): Promise<void>;
  /** Await any pending debounced persistent write. */
  flushSave(): Promise<void>;
}

export type DeepReadonly<T> = T extends readonly (infer E)[]
  ? readonly DeepReadonly<E>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCacheEntry(value: unknown): value is CacheEntry {
  return isRecord(value) && typeof value.timestamp === "number" && isRecord(value.block);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class TranslationCacheImpl implements TranslationCache {
  private readonly memory = new Map<string, CacheEntry>();
  private readonly cfg: Readonly<CacheConfig>;
  private readonly backend: Readonly<CacheBackend>;
  private readonly storageKey: string;
  private readonly saveDebounceMs: number;
  private sharedPersistentPromise: Promise<Record<string, CacheEntry>> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private saveChain: Promise<void> = Promise.resolve();

  constructor(cfg: Readonly<CacheConfig>, backend: Readonly<CacheBackend>) {
    this.cfg = cfg;
    this.backend = backend;
    this.storageKey = CACHE_STORAGE_KEY;
    this.saveDebounceMs = cfg.saveDebounceMs ?? 500;
  }

  private async loadPersistent(): Promise<Record<string, CacheEntry>> {
    const result = await this.backend.get(this.storageKey);
    const raw = result[this.storageKey];
    if (!isRecord(raw)) {
      return {};
    }
    const out: Record<string, CacheEntry> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (isCacheEntry(value)) {
        out[key] = value;
      }
    }
    return out;
  }

  private getShared(): Promise<Record<string, CacheEntry>> {
    this.sharedPersistentPromise ??= this.loadPersistent().catch((error: unknown) => {
      console.warn(
        "[mlg:bg] persistent cache read failed; starting empty:",
        getErrorMessage(error),
      );
      return {};
    });
    return this.sharedPersistentPromise;
  }

  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.runSave();
    }, this.saveDebounceMs);
  }

  private async runSave(): Promise<void> {
    if (this.sharedPersistentPromise === null) {
      return;
    }
    const cache = await this.sharedPersistentPromise;
    this.saveChain = this.saveChain
      .then(() => this.backend.set({ [this.storageKey]: evictCache(cache, this.cfg) }))
      .catch((error: unknown) => {
        console.warn("[mlg:bt] persistent cache write failed:", getErrorMessage(error));
      });
  }

  async clear(): Promise<void> {
    this.memory.clear();
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    const shared = await this.getShared();
    for (const key of Object.keys(shared)) {
      delete shared[key];
    }
    await this.backend.remove(this.storageKey);
  }

  async flushSave(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.runSave();
  }

  async getCacheStats(): Promise<{ entries: number; bytes: number }> {
    const cache = await this.getShared();
    const bytes = await this.backend.getBytesInUse(this.storageKey);
    return { entries: Object.keys(cache).length, bytes };
  }

  async lookup(html: string, from: string, to: string): Promise<CacheEntry | null> {
    const cacheKey = buildCacheKey(html, from, to);
    const memEntry = this.memory.get(cacheKey);
    if (memEntry && Date.now() - memEntry.timestamp < this.cfg.ttlMs) {
      return memEntry;
    }
    const persistent = await this.getShared();
    const persEntry = persistent[cacheKey];
    if (persEntry && Date.now() - persEntry.timestamp < this.cfg.ttlMs) {
      this.memory.set(cacheKey, persEntry);
      return persEntry;
    }
    return null;
  }

  async store(
    html: string,
    from: string,
    to: string,
    block: DeepReadonly<TranslationBlock>,
  ): Promise<void> {
    const cacheKey = buildCacheKey(html, from, to);
    const entry: CacheEntry = {
      block: {
        sentences: block.sentences.map((s) => ({
          source: s.source,
          translation: s.translation,
        })),
      },
      timestamp: Date.now(),
    };
    this.memory.set(cacheKey, entry);
    const persistent = await this.getShared();
    persistent[cacheKey] = entry;
    this.scheduleSave();
  }
}

/** Builds a two-layer cache over an injected storage backend. */
export function createTranslationCache(
  cfg: Readonly<CacheConfig>,
  backend: Readonly<CacheBackend>,
): TranslationCache {
  return new TranslationCacheImpl(cfg, backend);
}
