const ABBREVIATION_RE = /\b(?:Dr|Jr|Mr|Mrs|Ms|Prof|Sr|St|vs)\.$/iu;
const HTML_ENTITY_RE = /^&(?:#\d+|#x[\da-f]+|[a-z][\da-z]+);/iu;
const PLACEHOLDER_RE = /⟦\d+⟧/gu;
const TAG_OR_ENTITY_RE = /<[^>]*>|&(?:#\d+|#x[\da-f]+|[a-z][\da-z]+);/giu;

interface VisibleHtml {
  readonly text: string;
  readonly rawEnds: readonly number[];
}

function findTagEnd(html: string, start: number): number | null {
  let quote = "";
  for (let index = start + 1; index < html.length; index += 1) {
    const char = html[index] ?? "";
    if (quote !== "") {
      if (char === quote) quote = "";
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ">") {
      return index + 1;
    }
  }
  return null;
}

function decodeEntity(entity: string): string {
  const numeric = /^&#(?:(x)([\da-f]+)|(\d+));$/iu.exec(entity);
  if (numeric) {
    const radix = numeric[1] === "x" ? 16 : 10;
    const value = Number.parseInt(numeric[2] ?? numeric[3] ?? "", radix);
    return Number.isFinite(value) ? String.fromCodePoint(value) : " ";
  }
  const named: Readonly<Record<string, string>> = {
    "&amp;": "&",
    "&apos;": "'",
    "&gt;": ">",
    "&lt;": "<",
    "&nbsp;": " ",
    "&quot;": '"',
  };
  return named[entity.toLowerCase()] ?? " ";
}

function pushVisible(
  text: string,
  rawEnd: number,
  output: Readonly<{ text: string; rawEnds: readonly number[] }>,
): { text: string; rawEnds: number[] } {
  return {
    rawEnds: [...output.rawEnds, ...Array.from({ length: text.length }, () => rawEnd)],
    text: output.text + text,
  };
}

function visibleHtml(html: string): VisibleHtml {
  let output = { text: "", rawEnds: [] as number[] };
  let index = 0;
  while (index < html.length) {
    if (html[index] === "<") {
      const tagEnd = findTagEnd(html, index);
      if (tagEnd !== null) {
        index = tagEnd;
        continue;
      }
    }
    if (html[index] === "&") {
      const entity = HTML_ENTITY_RE.exec(html.slice(index))?.[0];
      if (entity !== undefined) {
        index += entity.length;
        output = pushVisible(decodeEntity(entity), index, output);
        continue;
      }
    }
    const codePoint = String.fromCodePoint(html.codePointAt(index) ?? 0);
    index += codePoint.length;
    output = pushVisible(codePoint, index, output);
  }
  return output;
}

function segmentEnds(text: string, language: "en" | "ja"): number[] {
  const segments = [...new Intl.Segmenter(language, { granularity: "sentence" }).segment(text)];
  const referenceRanges = Array.from(text.matchAll(/\[[^\]\r\n]+\](?:\[[^\]\r\n]+\])*/gu))
    .map((match) => ({ end: (match.index ?? 0) + match[0].length, start: match.index ?? 0 }))
    .filter(
      ({ start }) =>
        start > 0 &&
        /[.!?。！？]/u.test(text[start - 1] ?? "") &&
        !(language === "en" && ABBREVIATION_RE.test(text.slice(0, start).trimEnd())),
    );
  const ends = referenceRanges.map(({ end }) => end);
  let pendingEnd = 0;
  for (const segment of segments) {
    pendingEnd = segment.index + segment.segment.length;
    if (language === "en" && ABBREVIATION_RE.test(segment.segment.trimEnd())) continue;
    const currentEnd = pendingEnd;
    const containingReference = referenceRanges.find(
      ({ end, start }) => start < currentEnd && currentEnd <= end,
    );
    ends.push(containingReference?.end ?? currentEnd);
  }
  if (pendingEnd > (ends.at(-1) ?? 0)) ends.push(pendingEnd);
  return [...new Set(ends)].toSorted((left, right) => left - right);
}

function includeClosingTags(html: string, start: number): number {
  let end = start;
  while (html.startsWith("</", end)) {
    const tagEnd = findTagEnd(html, end);
    if (tagEnd === null) break;
    end = tagEnd;
  }
  return end;
}

export function splitHtmlSentences(html: string, language: "en" | "ja"): string[] {
  const visible = visibleHtml(html);
  if (!/[\p{L}\p{N}]/u.test(visible.text.replaceAll(PLACEHOLDER_RE, ""))) return [];
  const result: string[] = [];
  let rawStart = 0;
  for (const visibleEnd of segmentEnds(visible.text, language)) {
    const rawEnd = includeClosingTags(html, visible.rawEnds[visibleEnd - 1] ?? html.length);
    const source = html.slice(rawStart, rawEnd);
    if (/[\p{L}\p{N}]/u.test(plainText(source))) {
      result.push(source);
    } else if (result.length > 0) {
      result[result.length - 1] += source;
    }
    rawStart = rawEnd;
  }
  const trailing = html.slice(rawStart);
  if (result.length > 0) result[result.length - 1] += trailing;
  return result;
}

export function plainText(html: string): string {
  return html
    .replaceAll(TAG_OR_ENTITY_RE, (token) => (token.startsWith("&") ? decodeEntity(token) : ""))
    .replaceAll(PLACEHOLDER_RE, "")
    .trim();
}
