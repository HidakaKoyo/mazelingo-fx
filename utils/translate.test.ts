import { describe, expect, it, vi, type Mock } from "vitest";
import { translateBatch } from "./translate";
import type { TranslateDeps } from "./translate-core";
import {
  CACHE_MAX_ENTRIES,
  CACHE_TTL_MS,
  createTranslationCache,
  type CacheBackend,
  type TranslationCache,
} from "./cache";
import { mergeConfig, type Config } from "./config";
import type { TranslationBlock } from "./messages";

interface FakeCacheBackend extends CacheBackend {
  state: Record<string, unknown>;
}

interface LLMResult {
  blocks?: Array<{ i?: number; sentences?: TranslationBlock["sentences"] }>;
}

interface ParsedUserBlock {
  readonly i: number;
  readonly html: string;
}

interface SetupResult {
  backend: FakeCacheBackend;
  cache: TranslationCache;
  config: Config;
  deps: TranslateDeps;
  llm: Mock<LLMCall>;
}

type LLMCall = (models: readonly string[], messages: readonly unknown[]) => Promise<LLMResult>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseUserBlocks(messages: readonly unknown[]): ParsedUserBlock[] {
  const raw = isRecord(messages[1]) ? messages[1].content : undefined;
  if (typeof raw !== "string") {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const out: ParsedUserBlock[] = [];
      for (const item of parsed) {
        if (isRecord(item) && typeof item.i === "number" && typeof item.html === "string") {
          out.push({ i: item.i, html: item.html });
        }
      }
      return out;
    }
  } catch {
    // Ignore malformed JSON.
  }
  return [];
}

function makeCacheBackend(): FakeCacheBackend {
  const state: Record<string, unknown> = {};
  return {
    get(key: string): Promise<Record<string, unknown>> {
      return Promise.resolve({ [key]: state[key] });
    },
    getBytesInUse(_key: string): Promise<number> {
      return Promise.resolve(0);
    },
    remove(key: string): Promise<void> {
      delete state[key];
      return Promise.resolve();
    },
    set(item: Readonly<Record<string, unknown>>): Promise<void> {
      Object.assign(state, item);
      return Promise.resolve();
    },
    state,
  };
}

type ConfigOverrides = Readonly<Partial<Omit<Config, "models" | "apiKeys">>> & {
  readonly models?: readonly string[];
  readonly apiKeys?: Readonly<Record<string, string>>;
};

interface SetupOptions {
  readonly config?: ConfigOverrides;
  readonly onLLM?: (msgs: readonly unknown[]) => LLMResult;
}

function setup(overrides: SetupOptions = {}): Promise<SetupResult> {
  const backend = makeCacheBackend();
  const cache = createTranslationCache(
    { maxEntries: CACHE_MAX_ENTRIES, saveDebounceMs: 0, ttlMs: CACHE_TTL_MS },
    backend,
  );
  const config = mergeConfig(overrides.config ?? {});
  const llm: Mock<LLMCall> = vi.fn((models: readonly string[], messages: readonly unknown[]) => {
    if (overrides.onLLM) {
      return Promise.resolve(overrides.onLLM(messages));
    }
    // Default: echo each indexed block back as a single translation unit.
    const userJson = parseUserBlocks(messages);
    return Promise.resolve({
      blocks: userJson.map((b: Readonly<ParsedUserBlock>) => ({
        i: b.i,
        sentences: [
          { source: b.html, translation: `<p>「${b.html.replaceAll(/<\/?p>/gu, "")}」</p>` },
        ],
      })),
    });
  });
  const deps: TranslateDeps = {
    cache,
    getConfig: () => Promise.resolve(config),
    llm,
  };
  return Promise.resolve({ backend, cache, config, deps, llm });
}

function echoImpl(_models: readonly string[], msgs: readonly unknown[]): Promise<LLMResult> {
  const userJson = parseUserBlocks(msgs);
  if (userJson.length === 2) {
    return Promise.resolve({
      blocks: [
        { i: 0, sentences: [{ source: userJson[0]?.html ?? "", translation: "T0" }] },
        { i: 1, sentences: [] },
      ],
    });
  }
  const first = userJson[0];
  if (first === undefined) {
    return Promise.resolve({ blocks: [] });
  }
  return Promise.resolve({
    blocks: [{ i: first.i, sentences: [{ source: first.html, translation: "T1" }] }],
  });
}

describe("translateBatch", () => {
  it("returns empty blocks for an empty payload", async () => {
    const { deps } = await setup();
    const result = await translateBatch({ from: "en", htmlBlocks: [], to: "ja" }, deps);
    expect(result.blocks).toEqual([]);
  });
});

describe("translateBatch (caching)", () => {
  it("populates fresh results from the LLM and stores them in cache", async () => {
    const { deps, llm, cache } = await setup();
    const result = await translateBatch({ from: "en", htmlBlocks: ["<p>Hi</p>"], to: "ja" }, deps);
    expect(llm).toHaveBeenCalledTimes(1);
    // Default LLM mock echoes the html as the source and wraps text in <p>…
    expect(result.blocks[0]).toEqual({
      sentences: [{ source: "<p>Hi</p>", translation: "<p>「Hi」</p>" }],
    });
    // Cached for a subsequent call
    const hit = await cache.lookup("<p>Hi</p>", "en", "ja");
    expect(hit?.block).toEqual(result.blocks[0]);
  });

  it("serves a cached block without calling the LLM", async () => {
    const cached: TranslationBlock = {
      sentences: [{ source: "<p>Hi</p>", translation: "<p>こんにちは</p>" }],
    };
    const { deps, llm, cache } = await setup();
    await cache.store("<p>Hi</p>", "en", "ja", cached);
    const result = await translateBatch({ from: "en", htmlBlocks: ["<p>Hi</p>"], to: "ja" }, deps);
    expect(llm).not.toHaveBeenCalled();
    expect(result.blocks[0]).toEqual(cached);
  });
});

describe("translateBatch (retries)", () => {
  it("retries missing blocks individually and merges the result", async () => {
    const { deps, llm } = await setup();
    llm.mockImplementation((_models: readonly string[], msgs: readonly unknown[]) =>
      echoImpl(_models, msgs),
    );
    const result = await translateBatch({ from: "en", htmlBlocks: ["A", "B"], to: "ja" }, deps);
    expect(result.blocks[0]).toEqual({ sentences: [{ source: "A", translation: "T0" }] });
    expect(result.blocks[1]).toEqual({ sentences: [{ source: "B", translation: "T1" }] });
  });

  it("returns null for blocks that never resolve after retries", async () => {
    const { deps, llm } = await setup();
    llm.mockResolvedValue({ blocks: [] });
    const result = await translateBatch({ from: "en", htmlBlocks: ["A"], to: "ja" }, deps);
    expect(result.blocks[0]).toBeNull();
  });
});
