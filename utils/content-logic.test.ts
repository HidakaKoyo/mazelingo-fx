// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  assignBlockDisplayLanguages,
  cleanHtmlForTranslation,
  compilePageList,
  detectLang,
  endsWithReadingUnitPunctuation,
  hasTranslatableText,
  isPageAllowed,
  sanitizeHtmlFragment,
  shouldShowEnglish,
  splitHtmlByLineBreaks,
  stripHtmlTags,
} from "./content-logic";

describe("endsWithReadingUnitPunctuation", () => {
  it("returns true for sentence-final punctuation", () => {
    expect(endsWithReadingUnitPunctuation("こんにちは。")).toBe(true);
    expect(endsWithReadingUnitPunctuation("Hello!")).toBe(true);
    expect(endsWithReadingUnitPunctuation("Really?...")).toBe(true);
  });
  it("returns false for text without final punctuation", () => {
    expect(endsWithReadingUnitPunctuation("こんにちは")).toBe(false);
    expect(endsWithReadingUnitPunctuation("<b>Hi</b>")).toBe(false);
  });
});

describe("splitHtmlByLineBreaks", () => {
  it("splits a single blank line into two parts", () => {
    const result = splitHtmlByLineBreaks("Line one\n\nLine two");
    expect(result.parts).toEqual(["Line one", "Line two"]);
  });

  it("splits on a single newline only when the preceding text ends with punctuation", () => {
    const split = splitHtmlByLineBreaks("First sentence.\nSecond sentence.");
    expect(split.parts).toEqual(["First sentence.", "Second sentence."]);
  });

  it("keeps a single newline as one part when no sentence boundary", () => {
    const kept = splitHtmlByLineBreaks("This line wraps\nonto the next");
    expect(kept.parts).toEqual(["This line wraps\nonto the next"]);
  });
});

describe("sanitizeHtmlFragment", () => {
  it("removes disallowed tags but keeps their text", () => {
    expect(sanitizeHtmlFragment("<script>alert(1)</script><b>Hi</b>")).toBe("<b>Hi</b>");
  });

  it("strips on* event handlers", () => {
    expect(sanitizeHtmlFragment('<span onclick="alert(1)">Hi</span>')).toBe("<span>Hi</span>");
  });

  it("keeps https href but drops javascript: urls", () => {
    expect(sanitizeHtmlFragment('<a href="https://ok">link</a>')).toContain('href="https://ok"');
    expect(sanitizeHtmlFragment('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript");
  });
});

describe("cleanHtmlForTranslation", () => {
  it("strips attributes and preserves text structure", () => {
    const el = document.createElement("div");
    el.innerHTML = '<b class="x" onclick="bad">Hi <img src="i.png" /></b>';
    const cleaned = cleanHtmlForTranslation(el);
    expect(cleaned.html).toContain("<b>Hi");
    expect(cleaned.html).not.toContain('class="x"');
    expect(cleaned.html).not.toContain("onclick");
    expect(cleaned.html).toContain("⟦1⟧");
  });
});

describe("hasTranslatableText", () => {
  it("returns false for pure atom placeholders", () => {
    expect(hasTranslatableText("⟦1⟧")).toBe(false);
  });
  it("returns true when text content exists", () => {
    expect(hasTranslatableText("hello ⟦1⟧")).toBe(true);
  });
});

describe("compilePageList / isPageAllowed", () => {
  it("compiles a newline-separated glob list", () => {
    const matchers = compilePageList("https://example.com/*\nhttps://*.github.io/*");
    expect(matchers).toHaveLength(2);
  });

  it("returns false when the include list is empty", () => {
    expect(isPageAllowed("https://x.com", [], [])).toBe(false);
  });

  it("include matches and exclude overrides", () => {
    const exc = compilePageList("x.com/chat"),
      inc = compilePageList("https://*");
    expect(isPageAllowed("https://x.com/chat", inc, exc)).toBe(false);
    expect(isPageAllowed("https://x.com/other", inc, exc)).toBe(true);
  });
});

describe("shouldShowEnglish", () => {
  it("is deterministic for a given seed", () => {
    expect(shouldShowEnglish("Hello", 50, "seed")).toBe(shouldShowEnglish("Hello", 50, "seed"));
  });
  it("clamps ratio to 0-100", () => {
    expect(shouldShowEnglish("x", 200, "s")).toBe(true);
    expect(shouldShowEnglish("x", -5, "s")).toBe(false);
  });
});

describe("assignBlockDisplayLanguages", () => {
  it("uses each span source lang when mixLanguage is off", () => {
    const spans = [elSpan("en"), elSpan("ja")];
    const displays = assignBlockDisplayLanguages(spans, 50, false, "seed");
    expect(displays).toEqual(["en", "ja"]);
  });
  it("produces the requested english ratio deterministically", () => {
    const spans = Array.from({ length: 10 }, () => elSpan("en"));
    const displays = assignBlockDisplayLanguages(spans, 70, true, "seed");
    const enCount = displays.filter((d) => d === "en").length;
    expect(enCount).toBeGreaterThan(5);
  });
});

describe("detectLang", () => {
  it("detects Japanese vs English", () => {
    expect(detectLang("こんにちは")).toBe("ja");
    expect(detectLang("hello")).toBe("en");
  });
});

describe("stripHtmlTags", () => {
  it("removes tags and atom placeholders", () => {
    expect(stripHtmlTags("<b>Hi</b> ⟦1⟧")).toBe("Hi ");
  });
});

function elSpan(lang: string): HTMLElement {
  const span = document.createElement("span");
  span.dataset.mlgLang = lang;
  span.dataset.mlgSource = "source";
  document.body.append(span);
  return span;
}
