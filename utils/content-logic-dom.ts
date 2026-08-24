/**
 * DOM-touching content logic (sanitize / clone / clean / page matching /
 * display-language assignment), extracted from content-logic.ts so it can be
 * unit-tested in jsdom. These functions touch only DOM globals (document,
 * DOMParser, Element, Text) — no chrome.* — so they run unchanged in the
 * content script, the side panel, and Vitest. content-logic.ts re-exports these
 * to keep the public API unchanged.
 */
import { isMlgAtom, isMlgIgnoredElement } from "./dom-overlay";

const URL_SCHEME = /^([a-z][a-z0-9+.-]*):/iu;
const DATA_IMAGE_PREFIX = /^data:image\//iu;
const CONTROL_CHARS = /[\p{C}\u0020]+/gu;
const ATOM_PLACEHOLDER = /⟦\d+⟧/gu;
const GLOB_SPECIAL = /[.+^${}()|[\]\\?]/gu;

type AtomCounter = { current: number };
const CJK_CHARS = /[ぁ-んァ-ン一-龯]/u;
const HASH_MULTIPLIER = 2_654_435_761;
const MAX_RATIO = 100;

export const MLG_CLEAN_ATOM_ATTRIBUTE = "data-mlg-clean-atom";
export const MLG_ALLOWED_HTML_TAGS = new Set([
  "a",
  "b",
  "i",
  "em",
  "strong",
  "span",
  "img",
  "br",
  "code",
  "s",
  "u",
  "mark",
]);
export function compactUrlForSchemeCheck(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().replaceAll(CONTROL_CHARS, "");
}

export function isAllowedHref(value: unknown): boolean {
  return schemeIsHttpSafe(value);
}

export function isAllowedImageSrc(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  const compact = compactUrlForSchemeCheck(value);
  if (DATA_IMAGE_PREFIX.test(compact)) {
    return true;
  }
  const scheme = URL_SCHEME.exec(compact)?.[1]?.toLowerCase();
  return scheme === "http" || scheme === "https";
}

function schemeIsHttpSafe(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  const scheme = URL_SCHEME.exec(compactUrlForSchemeCheck(value))?.[1]?.toLowerCase();
  return scheme === undefined || scheme === "http" || scheme === "https";
}

const sanitizeChildren = (parent: ParentNode): void => {
  [...parent.children].forEach((element) => {
    sanitizeChildren(element);
    const tagName = element.tagName.toLowerCase();
    if (!MLG_ALLOWED_HTML_TAGS.has(tagName)) {
      element.replaceWith(...element.childNodes);
      return;
    }
    [...element.attributes].forEach((attribute) => {
      const attributeName = attribute.name.toLowerCase();
      if (attributeName.startsWith("on")) {
        element.removeAttribute(attribute.name);
        return;
      }
      const keepsAttribute =
        (tagName === "a" && attributeName === "href" && isAllowedHref(attribute.value)) ||
        (tagName === "img" && attributeName === "src" && isAllowedImageSrc(attribute.value)) ||
        (tagName === "img" && attributeName === "alt");
      if (!keepsAttribute) {
        element.removeAttribute(attribute.name);
      }
    });
  });
};

export function sanitizeHtmlFragment(html: string): string {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  sanitizeChildren(parsed.body);
  return parsed.body.innerHTML;
}

export interface CleanBlock {
  html: string;
  atoms: Map<number, Node>;
  clone: Element;
}

export interface ClonedBlock {
  clone: Element;
  atoms: Map<number, Node>;
}

/** Clone a block, stripping attributes and replacing native atoms with ⟦n⟧ placeholders. */
export function cleanHtmlForTranslation(block: Element): CleanBlock {
  const prepared = cloneBlockForTranslation(block);
  const deepClone = prepared.clone.cloneNode(true);
  if (!(deepClone instanceof Element)) {
    throw new Error("Expected element clone");
  }
  const serializedClone = replaceCloneAtomsWithPlaceholders(deepClone);
  return { atoms: prepared.atoms, clone: prepared.clone, html: serializedClone.innerHTML };
}

export function cloneBlockForTranslation(block: Element): ClonedBlock {
  const documentRef = block.ownerDocument;
  const clone = block.cloneNode(false);
  if (!(clone instanceof Element)) {
    throw new Error("Expected element clone");
  }
  const atoms = new Map<number, Node>();
  const nextAtomNumber = { current: 1 };
  [...block.childNodes].forEach((child) => {
    const childClone = cloneNodeForTranslation(documentRef, child, atoms, nextAtomNumber);
    if (childClone !== null) {
      clone.append(childClone);
    }
  });
  return { atoms, clone };
}

function cloneNodeForTranslation(
  documentRef: Document,
  node: Node,
  atoms: Map<number, Node>,
  nextAtomNumber: AtomCounter,
): Node | null {
  if (node instanceof Text) {
    return documentRef.createTextNode(node.data);
  }
  if (node.nodeType !== Node.ELEMENT_NODE || isMlgIgnoredElement(node)) {
    return null;
  }
  const elementClone = node.cloneNode(false);
  if (!(elementClone instanceof Element)) {
    return null;
  }
  if (isMlgAtom(node)) {
    const atomNumber = nextAtomNumber.current;
    nextAtomNumber.current += 1;
    atoms.set(atomNumber, node);
    elementClone.setAttribute(MLG_CLEAN_ATOM_ATTRIBUTE, String(atomNumber));
    return elementClone;
  }
  [...elementClone.attributes].forEach((attribute) => {
    const tagName = elementClone.tagName.toLowerCase();
    const attributeName = attribute.name.toLowerCase();
    const keepHref = tagName === "a" && attributeName === "href";
    if (!keepHref) {
      elementClone.removeAttribute(attribute.name);
    }
  });
  [...node.childNodes].forEach((child) => {
    const childClone = cloneNodeForTranslation(documentRef, child, atoms, nextAtomNumber);
    if (childClone !== null) {
      elementClone.append(childClone);
    }
  });
  return elementClone;
}

export function replaceCloneAtomsWithPlaceholders(clone: Element): Element {
  clone.querySelectorAll(`[${MLG_CLEAN_ATOM_ATTRIBUTE}]`).forEach((element) => {
    const atomNumber = element.getAttribute(MLG_CLEAN_ATOM_ATTRIBUTE);
    element.replaceWith(clone.ownerDocument.createTextNode(`⟦${atomNumber}⟧`));
  });
  return clone;
}

export function serializeCleanPart(html: string): string {
  const container = document.createElement("div");
  container.innerHTML = html;
  replaceCloneAtomsWithPlaceholders(container);
  return container.innerHTML;
}

export function hasTranslatableText(cleanedHtml: string): boolean {
  const text = textFromContainer(cleanedHtml);
  return text.trim().length > 0;
}

export function stripHtmlTags(html: string): string {
  return textFromContainer(html);
}

function textFromContainer(html: string): string {
  const container = document.createElement("div");
  container.innerHTML = html;
  return (container.textContent ?? "").replaceAll(ATOM_PLACEHOLDER, "");
}

export interface PageMatcher {
  pattern: string;
  regex: RegExp;
}

export function normalizePagePattern(pattern: string): string {
  if (pattern.length === 0) {
    return "";
  }
  if (pattern.includes("://")) {
    return pattern;
  }
  return `*://${pattern}`;
}

export function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replaceAll(GLOB_SPECIAL, String.raw`\$&`);
  return new RegExp(`^${escaped.replaceAll("*", ".*")}$`, "iu");
}

export function compilePageList(list: string | null | undefined): PageMatcher[] {
  return (list ?? "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((pattern) => ({ pattern, regex: globToRegExp(normalizePagePattern(pattern)) }));
}

export function isPageAllowed(
  href: string,
  include: readonly PageMatcher[],
  exclude: readonly PageMatcher[],
): boolean {
  if (include.length === 0) {
    return false;
  }
  const included = include.some((matcher) => matcher.regex.test(href));
  if (!included) {
    return false;
  }
  return !exclude.some((matcher) => matcher.regex.test(href));
}

// Bit-identical to the JS original; the hash seeds the per-page language
// assignment, so changing it would re-mix every page users have already seen.
export function hashString(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    // oxlint-disable-next-line unicorn/prefer-code-point
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function shouldShowEnglish(text: string, ratio: number, seed: string): boolean {
  const normalized = Math.max(0, Math.min(MAX_RATIO, ratio || 0));
  return hashString(`${seed}::${text}`) % MAX_RATIO < normalized;
}

/**
 * Deterministically assign each span a default display language (en/ja) matching
 * the configured englishRatio, seeded so a given page keeps the same mix.
 */
export function assignBlockDisplayLanguages(
  spans: readonly HTMLElement[],
  ratio: number,
  mixLanguage: boolean,
  seed: string,
): string[] {
  if (!mixLanguage) {
    return spans.map((span) => span.dataset.mlgLang ?? "en");
  }
  const total = spans.length;
  const seeded = hashString(`${seed}::${spans.map((s) => s.dataset.mlgSource).join("|")}`);
  const exact = (total * ratio) / MAX_RATIO;
  const floor = Math.floor(exact);
  const frac = exact - floor;
  const roundUp = Math.abs(Math.trunc(seeded * HASH_MULTIPLIER)) % MAX_RATIO < frac * MAX_RATIO;
  const englishCount = roundUp ? floor + 1 : floor;
  const displays: string[] = [];
  for (let index = 0; index < total; index++) {
    displays.push(index < englishCount ? "en" : "ja");
  }
  for (let index = displays.length - 1; index > 0; index--) {
    const swapIndex = Math.abs(Math.trunc(seeded * (index + 1) * HASH_MULTIPLIER)) % (index + 1);
    const left = displays[index] ?? "en";
    const right = displays[swapIndex] ?? "en";
    displays[index] = right;
    displays[swapIndex] = left;
  }
  return displays;
}

export function detectLang(text: string): "en" | "ja" {
  return CJK_CHARS.test(text) ? "ja" : "en";
}
