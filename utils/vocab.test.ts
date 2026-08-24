import { describe, expect, it, vi } from "vitest";
import { createVocabStore, matchVocabInText, normalizeVocab } from "./vocab";
import { VOCAB_STORAGE_KEY } from "./keys";
import type { VocabBackend } from "./vocab";

function isItemsBox(value: unknown): value is { items: unknown[] } {
  return (
    typeof value === "object" && value !== null && "items" in value && Array.isArray(value.items)
  );
}

function makeBackend(seed: Readonly<Record<string, unknown>> = {}): VocabBackend {
  const state: Record<string, unknown> = { ...seed };
  const backend: VocabBackend = {
    fetch: vi.fn(() =>
      Promise.resolve({ json: () => Promise.resolve([{ en: "hello", ja: "こんにちは" }]) }),
    ),
    get(key: string) {
      return Promise.resolve({ [key]: state[key] });
    },
    getURL: (path: string) => `chrome-extension://test/${path}`,
    set(item: Readonly<Record<string, unknown>>) {
      Object.assign(state, item);
      return Promise.resolve();
    },
  };
  return backend;
}

describe("createVocabStore", () => {
  it("seeds from vocab_data.json on first init", async () => {
    const backend = makeBackend();
    const store = createVocabStore(backend);
    const items = await store.initIfNeeded();
    expect(items[0]).toEqual({ count: 0, en: "hello", ja: "こんにちは" });
    // Persisted
    const result = await backend.get(VOCAB_STORAGE_KEY);
    const stored = result[VOCAB_STORAGE_KEY];
    expect((isItemsBox(stored) ? stored : undefined)?.items).toHaveLength(1);
  });

  it("returns existing vocab on subsequent init", async () => {
    const store = createVocabStore(makeBackend());
    await store.initIfNeeded();
    const store2 = createVocabStore(makeBackend());
    const items = await store2.initIfNeeded();
    expect(items).toHaveLength(1);
  });
});

describe("matchVocabInText", () => {
  it("matches whole words case-insensitively", () => {
    const items = [
      { count: 0, en: "Hello", ja: "こんにちは" },
      { count: 0, en: "deep learning", ja: "深層学習" },
    ];
    expect(matchVocabInText("say HELLO and deep learning too", items)).toEqual([
      "Hello",
      "deep learning",
    ]);
  });

  it("does not match inside a longer word (word boundary)", () => {
    const items = [{ count: 0, en: "cat", ja: "猫" }];
    expect(matchVocabInText("category", items)).toEqual([]);
  });

  it("escapes regex special characters", () => {
    const items = [{ count: 0, en: "a.b", ja: "" }];
    expect(matchVocabInText("a.b", items)).toEqual(["a.b"]);
    expect(matchVocabInText("axb", items)).toEqual([]);
  });
});

describe("normalizeVocab", () => {
  it("removes the ~ wildcard placeholder and collapses whitespace", () => {
    // Matches the original scoring: "from ~ perspective" and "fromperspective"
    // Compare equal, so existing "from ~ perspective" items never re-suggest.
    expect(normalizeVocab("from ~ perspective")).toBe("fromperspective");
    expect(normalizeVocab("  hello   world  ")).toBe("hello world");
  });
});
