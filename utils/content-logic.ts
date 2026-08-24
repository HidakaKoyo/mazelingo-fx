/**
 * Pure content-script logic for splitting HTML into reading units, kept in its
 * own file so it can be unit-tested in jsdom without touching the DOM. The
 * DOM-touching functions live in content-logic-dom.ts and are re-exported here
 * to keep the public API unchanged.
 */

const HTML_TAGS = /<[^>]*>/gu;
const READING_UNIT_END_RE = /[。．.!！?？…」』）)]$/u;
const WHITESPACE_BREAK = /(?:\r\n|\n|<br\b[^>]*>)(?:[ \t]*(?:\r\n|\n|<br\b[^>]*>))*/giu;
const SINGLE_BREAK = /\r\n|\n|<br\b[^>]*>/giu;

export function endsWithReadingUnitPunctuation(html: string): boolean {
  const text = html.replaceAll(HTML_TAGS, "").trimEnd();
  return READING_UNIT_END_RE.test(text);
}

export interface SplitResult {
  parts: string[];
  separators: string[];
}

/**
 * Split an HTML fragment into translation chunks at newline boundaries. A blank
 * line always splits; a single newline/<br> splits only when the preceding text
 * ends with reading-unit punctuation. Separators are kept so they can be
 * re-inserted between translated parts.
 */
export function splitHtmlByLineBreaks(html: string): SplitResult {
  const rawParts: string[] = [];
  const rawSeparators: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WHITESPACE_BREAK.exec(html)) !== null) {
    const breakCount = (match[0].match(SINGLE_BREAK) ?? []).length;
    const shouldSplit =
      breakCount >= 2 || endsWithReadingUnitPunctuation(html.slice(lastIndex, match.index));
    if (shouldSplit) {
      rawParts.push(html.slice(lastIndex, match.index));
      rawSeparators.push(match[0]);
      lastIndex = WHITESPACE_BREAK.lastIndex;
    }
  }
  rawParts.push(html.slice(lastIndex));

  const parts: string[] = [];
  const separators: string[] = [];
  let pendingSeparator = "";
  for (let index = 0; index < rawParts.length; index++) {
    const part = rawParts[index] ?? "";
    if (part.trim()) {
      parts.push(part);
      if (parts.length > 1) {
        separators.push(pendingSeparator);
      }
      pendingSeparator = "";
    }
    if (index < rawSeparators.length) {
      pendingSeparator += rawSeparators[index] ?? "";
    }
  }
  return { parts, separators };
}

export {
  MLG_CLEAN_ATOM_ATTRIBUTE,
  MLG_ALLOWED_HTML_TAGS,
  compactUrlForSchemeCheck,
  isAllowedHref,
  isAllowedImageSrc,
  sanitizeHtmlFragment,
  cleanHtmlForTranslation,
  cloneBlockForTranslation,
  replaceCloneAtomsWithPlaceholders,
  serializeCleanPart,
  hasTranslatableText,
  stripHtmlTags,
  normalizePagePattern,
  globToRegExp,
  compilePageList,
  isPageAllowed,
  hashString,
  shouldShowEnglish,
  assignBlockDisplayLanguages,
  detectLang,
} from "./content-logic-dom";
export type { CleanBlock, ClonedBlock, PageMatcher } from "./content-logic-dom";
