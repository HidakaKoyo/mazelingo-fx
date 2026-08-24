import { describe, expect, it } from "vitest";
import { createNormaCache, evictNorma } from "./norma";
import { NORMA_CACHE_KEY } from "./keys";
import type { NormaBackend } from "./norma";

function makeBackend(
  seed: Readonly<Record<string, unknown>> = {},
): NormaBackend & { state: Record<string, unknown> } {
  const state: Record<string, unknown> = { ...seed };
  return {
    get(key: string) {
      return Promise.resolve({ [key]: state[key] });
    },
    set(item: Readonly<Record<string, unknown>>) {
      Object.assign(state, item);
      return Promise.resolve();
    },
    state,
  };
}

describe("createNormaCache", () => {
  it("marks then checks a text key as done", async () => {
    const backend = makeBackend(),
      norma = createNormaCache(backend);
    await norma.markNormaDone("some:key");
    const result = await norma.checkNormaDone(["some:key"]);
    expect(result["some:key"]).toBe(true);
  });

  it("returns false for keys with no entry", async () => {
    const backend = makeBackend(),
      norma = createNormaCache(backend),
      result = await norma.checkNormaDone(["missing"]);
    expect(result.missing).toBe(false);
  });

  it("persists to the designated storage key", async () => {
    const backend = makeBackend(),
      norma = createNormaCache(backend);
    await norma.markNormaDone("k1");
    expect(backend.state[NORMA_CACHE_KEY]).toBeDefined();
  });
});

describe("evictNorma", () => {
  it("evicts entries past the 30-day TTL", () => {
    const now = Date.now();
    const cache = {
      fresh: { timestamp: now },
      old: { timestamp: now - 31 * 24 * 60 * 60 * 1000 },
    };
    const evicted = evictNorma(cache);
    expect("old" in evicted).toBe(false);
    expect("fresh" in evicted).toBe(true);
  });

  it("caps entries to 500 keeping the newest", () => {
    const cache: Record<string, { timestamp: number }> = {},
      now = Date.now();
    for (let i = 0; i < 501; i++) {
      cache[String(i)] = { timestamp: now - i * 1000 };
    }
    const evicted = evictNorma(cache);
    expect(Object.keys(evicted)).toHaveLength(500);
  });
});
