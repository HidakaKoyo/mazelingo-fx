import { describe, expect, it } from "vitest";
import {
  buildResplitMessages,
  buildTranslationMessages,
  getPlainTextLengthInfo,
  isLongTranslationUnit,
  reconcileIndexedBlocks,
  sourcesRejoin,
} from "./translation";

describe("getPlainTextLengthInfo", () => {
  it("detects CJK-dominant text and applies the shorter 45-char limit", () => {
    const info = getPlainTextLengthInfo("<p>日本語のテキストです</p>");
    expect(info.isCjkDominant).toBe(true);
    expect(info.limit).toBe(45);
  });

  it("detects Latin-dominant text and applies the longer 140-char limit", () => {
    const info = getPlainTextLengthInfo("The quick brown fox jumps over the lazy dog");
    expect(info.isCjkDominant).toBe(false);
    expect(info.limit).toBe(140);
  });

  it("strips HTML tags before measuring", () => {
    const info = getPlainTextLengthInfo("<b>Hello</b> world");
    // "Hello world" = 11 chars
    expect(info.length).toBe(11);
  });

  it("counts full code points, not surrogate halves", () => {
    const info = getPlainTextLengthInfo("😀😀😀");
    expect(info.length).toBe(3);
  });
});

describe("isLongTranslationUnit", () => {
  it("is false for short CJK", () => {
    expect(isLongTranslationUnit("これは短い。")).toBe(false);
  });

  it("is true for CJK over 45 chars", () => {
    expect(isLongTranslationUnit("あ".repeat(46))).toBe(true);
  });

  it("is false for a blank source", () => {
    expect(isLongTranslationUnit("")).toBe(false);
  });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIndexedBlockArray(value: unknown): value is Array<{ html: string; i: number }> {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (!isRecord(item)) return false;
    return typeof item.html === "string" && typeof item.i === "number";
  });
}

describe("buildTranslationMessages", () => {
  it("embeds the language names and the indexed blocks as JSON", () => {
    const messages = buildTranslationMessages([{ html: "<p>Hi</p>", i: 0 }], "English", "Japanese");
    const [system, user] = messages;
    if (!system || !user) throw new Error("expected system and user messages");
    expect(system.role).toBe("system");
    expect(system.content).toContain("from English to Japanese");
    const userContent: unknown = JSON.parse(user.content);
    if (!isIndexedBlockArray(userContent)) throw new Error("expected indexed block array");
    expect(userContent[0]).toMatchObject({ html: "<p>Hi</p>", i: 0 });
  });
});

describe("buildResplitMessages", () => {
  it("returns a system + user pair referencing the source", () => {
    const messages = buildResplitMessages("long unit here", "English", "Japanese");
    expect(messages).toHaveLength(2);
    const [system, user] = messages;
    if (!system || !user) throw new Error("expected system and user messages");
    expect(user.content).toBe("long unit here");
    expect(system.content).toContain("2 to 6 clause-sized");
  });
});

function registerAcceptedBlockTest(): void {
  it("accepts exactly one valid block per expected index", () => {
    const raw = [
        { i: 0, sentences: [{ source: "a", translation: "A" }] },
        { i: 1, sentences: [{ source: "b", translation: "B" }] },
      ],
      result = reconcileIndexedBlocks(raw, [0, 1]);
    expect(result.acceptedBlocks.get(0)).toEqual({
      sentences: [{ source: "a", translation: "A" }],
    });
    expect(result.acceptedBlocks.get(1)).toEqual({
      sentences: [{ source: "b", translation: "B" }],
    });
    expect(result.missingIndices).toEqual([]);
    expect(result.receivedCount).toBe(2);
  });
}

function registerRejectedBlockTests(): void {
  it("flags out-of-range indices and strips their i field", () => {
    const raw = [{ i: 99, sentences: [{ source: "a", translation: "A" }] }],
      result = reconcileIndexedBlocks(raw, [0]);
    expect(result.outOfRangeIndices).toEqual([99]);
    expect(result.missingIndices).toEqual([0]);
    expect(result.receivedCount).toBe(1);
  });

  it("flags duplicates and only keeps the first occurrence", () => {
    const raw = [
        { i: 0, sentences: [{ source: "first", translation: "F" }] },
        { i: 0, sentences: [{ source: "second", translation: "S" }] },
      ],
      result = reconcileIndexedBlocks(raw, [0]);
    expect(result.duplicateIndices).toEqual([0]);
    // Duplicates are not accepted (nor invalid); they count as missing
    expect(result.acceptedBlocks.get(0)).toBeUndefined();
    expect(result.missingIndices).toEqual([0]);
  });
}

function registerEdgeCaseTests(): void {
  it("marks a block invalid when it has no sentences but is in range", () => {
    const raw = [{ i: 0, sentences: [] }],
      result = reconcileIndexedBlocks(raw, [0]);
    expect(result.invalidIndices).toEqual([0]);
    expect(result.missingIndices).toEqual([0]);
  });

  it("returns an empty accepted set for a non-array input", () => {
    const result = reconcileIndexedBlocks(null, [0, 1]);
    expect(result.receivedCount).toBe(0);
    expect(result.missingIndices).toEqual([0, 1]);
  });

  it("drops the i field from accepted blocks (only sentences are kept)", () => {
    const raw = [{ i: 0, sentences: [{ source: "a", translation: "A" }] }],
      result = reconcileIndexedBlocks(raw, [0]);
    const accepted = result.acceptedBlocks.get(0);
    if (!accepted) throw new Error("expected an accepted block");
    expect("i" in accepted).toBe(false);
  });
}

describe("reconcileIndexedBlocks", () => {
  registerAcceptedBlockTest();
  registerRejectedBlockTests();
  registerEdgeCaseTests();
});

describe("sourcesRejoin", () => {
  it("returns true when concatenated sources reproduce the source exactly", () => {
    const sentences = [
      { source: "今日は", translation: "Today " },
      { source: "雨だった。", translation: "it rained." },
    ];
    expect(sourcesRejoin(sentences, "今日は雨だった。")).toBe(true);
  });

  it("returns false for a single-unit candidate (needs 2+ to be a rejoin)", () => {
    expect(sourcesRejoin([{ source: "a", translation: "A" }], "a")).toBe(true);
    expect(sourcesRejoin(undefined, "a")).toBe(false);
  });
});
