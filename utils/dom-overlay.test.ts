// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitizeHtmlFragment } from "./content-logic";
import {
  buildTokenStream,
  collectElementTags,
  isMlgAtom,
  isMlgIgnoredElement,
  locateUnitRange,
  normalizeStreamForMatching,
  normalizeUnitText,
  renderOriginal,
  renderVariant,
  structureSignature,
  variantTagSequencesMatch,
  wrapRange,
} from "./dom-overlay";
function assertNonNull<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("expected a non-null value");
  }
  return value;
}

function el(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  const first = container.firstElementChild;
  if (!(first instanceof HTMLElement)) {
    throw new Error("expected an HTMLElement");
  }
  document.body.append(first);
  return first;
}

function wrapContents(html: string): HTMLElement {
  const root = el(`<div>${html}</div>`);
  const range = document.createRange();
  range.selectNodeContents(root);
  return wrapRange(range);
}

describe("isMlgIgnoredElement / isMlgAtom", () => {
  it("ignores script/style and aria-hidden", () => {
    expect(isMlgIgnoredElement(el("<script>x</script>"))).toBe(true);
    expect(isMlgIgnoredElement(el('<div aria-hidden="true">x</div>'))).toBe(true);
    expect(isMlgIgnoredElement(el("<div>x</div>"))).toBe(false);
  });

  it("treats media/empty elements as atoms", () => {
    expect(isMlgAtom(el('<img src="x" />'))).toBe(true);
    expect(isMlgAtom(el("<span></span>"))).toBe(true);
    expect(isMlgAtom(el("<span>text</span>"))).toBe(false);
  });
});

describe("normalizeUnitText", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeUnitText("  hello   world  ")).toBe("hello world");
    expect(normalizeUnitText("")).toBe("");
  });
});

describe("buildTokenStream", () => {
  it("extracts text and atom tokens in order", () => {
    const root = el('<div>Hello <img src="a" /> world</div>');
    const stream = buildTokenStream(root);
    const types: string[] = [];
    for (const t of stream) {
      types.push(t.type);
    }
    expect(types).toEqual(["text", "atom", "text"]);
    expect(stream[0]).toMatchObject({ text: "Hello ", type: "text" });
    expect(stream[1]).toMatchObject({ text: "⟦1⟧", type: "atom" });
    expect(stream[2]).toMatchObject({ text: " world", type: "text" });
  });
});

describe("locateUnitRange", () => {
  it("finds the range for a plain-text prefix of the block", () => {
    const root = el("<div>Hello world again</div>");
    const stream = buildTokenStream(root);
    const located = locateUnitRange(stream, "Hello world");
    expect(located).not.toBeNull();
    const range = document.createRange();
    range.setStart(assertNonNull(located?.startContainer), assertNonNull(located?.startOffset));
    range.setEnd(assertNonNull(located?.endContainer), assertNonNull(located?.endOffset));
    expect(range.toString()).toBe("Hello world");
  });

  it("returns null when the source is not present", () => {
    const root = el("<div>Hello</div>");
    const stream = buildTokenStream(root);
    expect(locateUnitRange(stream, "missing text")).toBeNull();
  });

  it("normalizes whitespace before matching", () => {
    const root = el("<div>Hello&nbsp; world</div>");
    const stream = buildTokenStream(root);
    const located = locateUnitRange(stream, "Hello world");
    expect(located).not.toBeNull();
  });
});

describe("wrapRange", () => {
  it("wraps a range in a .mlg-sentence span that preserves atom metadata", () => {
    const root = el('<div>Hello <img src="a" /> world</div>');
    const stream = buildTokenStream(root);
    const located = locateUnitRange(stream, "Hello");
    const range = document.createRange();
    range.setStart(assertNonNull(located?.startContainer), assertNonNull(located?.startOffset));
    range.setEnd(assertNonNull(located?.endContainer), assertNonNull(located?.endOffset));
    const span = wrapRange(range);
    expect(span.classList.contains("mlg-sentence")).toBe(true);
    expect(span.mlgAtomNumbers).toEqual([]);
  });
});

describe("structureSignature", () => {
  it("ignores data-mlg attributes and mlg-sentence wrappers by default", () => {
    const root = el('<div><span data-mlg-sentence="1"><b>Hi</b></span><i>yo</i></div>');
    const sig = structureSignature(root);
    // B and i are collected; the wrapper span and data-mlg attrs are ignored
    expect(sig.map((s: readonly [string, readonly string[], boolean]) => s[0])).toEqual([
      "div",
      "b",
      "i",
    ]);
  });
});

describe("renderVariant / renderOriginal", () => {
  it("renders a matching variant and restores the original", () => {
    const root = el("<div>Hello <b>world</b></div>");
    const stream = buildTokenStream(root);
    // the source passed to locateUnitRange is the *plain text* unit
    const located = locateUnitRange(stream, "Hello world");
    const range = document.createRange();
    range.setStart(assertNonNull(located?.startContainer), assertNonNull(located?.startOffset));
    range.setEnd(assertNonNull(located?.endContainer), assertNonNull(located?.endOffset));
    const span = wrapRange(range);
    renderVariant(span, "¡Hola <b>mundo</b>!");
    expect(span.textContent).toBe("¡Hola mundo!");
    renderOriginal(span);
    expect(span.textContent).toBe("Hello world");
  });

  it("keeps a superscript footnote when the sanitized variant matches the original tags", () => {
    const html = '<sup class="reference"><a href="https://example.com">[1]</a></sup>';
    const span = wrapContents(html);
    renderVariant(span, sanitizeHtmlFragment(html));
    expect(span.firstElementChild).toBe(span.querySelector("sup"));
    expect(span.querySelector("sup > a")?.textContent).toBe("[1]");
  });

  it.each([
    ["bold", "<b>Machine translation</b> is the use of software.", "b"],
    ["link", '<a href="/wiki/Machine_translation">Machine translation</a> is useful.', "a"],
    [
      "reference",
      '<sup class="reference"><a href="#cite_note-1">[1]</a></sup> Effective improvement.',
      "sup",
    ],
  ])("renders fallback text outside an initial %s element", (_name, html, selector) => {
    const span = wrapContents(html);
    renderVariant(span, "翻訳された文章です。");
    expect(span.firstChild).toBeInstanceOf(Text);
    expect(span.firstChild?.textContent).toBe("翻訳された文章です。");
    expect(span.querySelector(selector)?.textContent).toBe("");
  });

  it("keeps fallback text inside a single shared italic parent", () => {
    const span = wrapContents("<i>Everything is italic.</i>");
    renderVariant(span, "すべて斜体です。");
    expect(span.querySelector("i")?.textContent).toBe("すべて斜体です。");
    expect(span.firstChild).toBe(span.querySelector("i"));
  });
});

describe("collectElementTags / variantTagSequencesMatch", () => {
  it("compares non-atom element tag sequences", () => {
    const a = el("<div><b>x</b><img /></div>"),
      b = el("<div><i>y</i><img /></div>");
    // CollectElementTags walks the children below the root, so div is excluded
    expect(collectElementTags(a)).toEqual(["b"]);
    expect(collectElementTags(b)).toEqual(["i"]);
    expect(variantTagSequencesMatch(a, b)).toBe(false);
  });
});

describe("normalizeStreamForMatching", () => {
  it("collapses runs of whitespace to a single space in the matching text", () => {
    const root = el("<div>a&nbsp;&nbsp; b</div>");
    const stream = buildTokenStream(root);
    const result = normalizeStreamForMatching(stream);
    expect(result.text).toBe("a b");
  });
});
