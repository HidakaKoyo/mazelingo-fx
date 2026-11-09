import { describe, expect, it } from "vitest";
import { plainText, splitHtmlSentences } from "./plamo-segment";

describe("splitHtmlSentences", () => {
  it.each([
    ["English abbreviation", "Dr. Smith arrived. He sat down.", "en", 2],
    ["decimal", "The value is 3.14. It is exact.", "en", 2],
    ["English quotation", "He said “Hello.” Then left.", "en", 2],
    ["Japanese brackets and numbers", "「今日は3日です。」次は4日です。", "ja", 2],
    ["inline tags", "<b>Hello</b> world. Next sentence.", "en", 2],
    ["placeholder", "First ⟦1⟧ sentence. <em>Second</em> sentence.", "en", 2],
  ] as const)("splits %s without changing the source", (_name, html, language, count) => {
    const sentences = splitHtmlSentences(html, language);
    expect(sentences).toHaveLength(count);
    expect(sentences.join("")).toBe(html);
  });

  it("keeps placeholders in the source and removes them from model text", () => {
    const html = "Before ⟦1⟧. After.";
    expect(splitHtmlSentences(html, "en").join("")).toContain("⟦1⟧");
    expect(plainText(html)).toBe("Before . After.");
  });

  it("does not return empty, tag-only, whitespace-only, or placeholder-only sources", () => {
    expect(splitHtmlSentences(" <b> </b> ⟦1⟧ ", "en")).toEqual([]);
    const html = "<b> </b>Hello. <i> </i>Next.";
    const sentences = splitHtmlSentences(html, "en");
    expect(sentences.every((source) => /[\p{L}\p{N}]/u.test(plainText(source)))).toBe(true);
    expect(sentences.join("")).toBe(html);
  });
});

describe("splitHtmlSentences bracket groups", () => {
  it("separates consecutive Wikipedia references from the preceding sentence", () => {
    const html =
      'fully.<sup class="reference"><a href="#cite_note-1">[1]</a></sup><sup class="reference"><a href="#cite_note-2">[2]</a></sup> Effective improvement continues.';
    const sentences = splitHtmlSentences(html, "en");
    expect(sentences).toEqual([
      "fully.",
      '<sup class="reference"><a href="#cite_note-1">[1]</a></sup><sup class="reference"><a href="#cite_note-2">[2]</a></sup>',
      " Effective improvement continues.",
    ]);
    expect(sentences.join("")).toBe(html);
  });

  it("separates a citation-needed reference from the preceding sentence", () => {
    const html = "This claim is disputed.[citation needed] More text follows.";
    const sentences = splitHtmlSentences(html, "en");
    expect(sentences).toEqual([
      "This claim is disputed.",
      "[citation needed]",
      " More text follows.",
    ]);
    expect(sentences.join("")).toBe(html);
  });

  it("separates a Wikipedia edit link from a heading", () => {
    const html =
      'History<span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="#">edit</a><span class="mw-editsection-bracket">]</span></span>';
    expect(splitHtmlSentences(html, "en")).toEqual([
      "History",
      '<span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="#">edit</a><span class="mw-editsection-bracket">]</span></span>',
    ]);
  });
});
