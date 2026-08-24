/**
 * Pure translation pipeline helpers, extracted from the background service
 * worker so they can be unit-tested without chrome.* mocks.
 *
 * These are the "reading unit" rules the whole product hangs on:
 *   - offline length heuristics decide when a unit is "too long" and must be
 *     re-split,
 *   - the system/use prompts tell the LLM how to segment HTML,
 *   - reconcileIndexedBlocks validates 1:1 correspondence between LLM output
 *     and the requested input block indices.
 */
import type { ChatMessage } from "./llm";
import type { TranslationBlock, TranslationUnit } from "./messages";

const CJK_CHAR_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u3005\u3007\u30FC]/u;
const LETTER_OR_NUMBER_RE = /[\p{L}\p{N}]/u;
const CJK_LONG_UNIT_LIMIT = 45;
const OTHER_LONG_UNIT_LIMIT = 140;

export const LANG_NAMES: Record<string, string> = {
  en: "English",
  ja: "Japanese",
};

export interface LengthInfo {
  length: number;
  limit: number;
  isCjkDominant: boolean;
}

export function getPlainTextLengthInfo(html: unknown): LengthInfo {
  const plain = (typeof html === "string" ? html : "").replaceAll(/<[^>]*>/gu, "");
  const chars = Array.from(plain);
  let cjkCount = 0;
  let letterOrNumberCount = 0;
  for (const char of chars) {
    if (CJK_CHAR_RE.test(char)) {
      cjkCount++;
    }
    if (LETTER_OR_NUMBER_RE.test(char)) {
      letterOrNumberCount++;
    }
  }
  const isCjkDominant = cjkCount > 0 && cjkCount * 2 >= letterOrNumberCount;
  return {
    isCjkDominant,
    length: chars.length,
    limit: isCjkDominant ? CJK_LONG_UNIT_LIMIT : OTHER_LONG_UNIT_LIMIT,
  };
}

export function isLongTranslationUnit(source: unknown): boolean {
  const { length, limit } = getPlainTextLengthInfo(source);
  return length > limit;
}

export function buildResplitMessages(
  source: string,
  fromName: string,
  toName: string,
): ChatMessage[] {
  return [
    {
      content: `You receive ONE long HTML unit. Split it into 2 to 6 clause-sized reading units and translate each unit from ${fromName} to ${toName}.

Return JSON with exactly one "blocks" entry containing "i": 0 and a "sentences" array of { "source", "translation" } objects.

Rules:
- Every source must be an exact, complete substring of the input HTML, and concatenating all sources in order must reproduce the input exactly
- Preserve HTML tags in source and translation; do not split inside a noun phrase, quotation/title, URL, or matched HTML tag pair
- Tokens such as ⟦1⟧ are placeholders for images or icons. Do not translate them; keep each token unchanged at the corresponding position in source and translation
- Translate using the context of the whole unit so the concatenated unit translations read naturally`,
      role: "system",
    },
    { content: source, role: "user" },
  ];
}

export function buildTranslationMessages(
  indexedBlocks: readonly Readonly<{ i: number; html: string }>[],
  fromName: string,
  toName: string,
): ChatMessage[] {
  return [
    {
      content: `You are a professional translator. You receive an array of numbered HTML snippet objects. For each snippet, split the source into natural reading units and translate each unit from ${fromName} to ${toName}.

Each input object has an integer "i" and an "html" snippet. Return a JSON "blocks" array with one entry per input object. Every output block must include the same "i" as its input and a "sentences" array. Do not merge multiple inputs into one output block; return every input exactly once in a 1:1 correspondence. Each unit has "source" (original HTML) and "translation" (translated HTML).

Segmentation rules:
- A newline is normally a boundary. Keep text across a newline in one unit only when the next line is clearly a visual wrap that continues the same sentence; when uncertain, split
- Sentence-ending punctuation (. 。 ． ! ！ ? ？ …) is a boundary. Japanese often omits the final punctuation, so also split where one sentence ends with forms such as …かな, …だろ, …よね, …です, …ます, …た, or a closing bracket/quote and the next sentence begins
- If one sentence is long (roughly over 40 Japanese characters or 20 English words), split it into clause-sized units at 、 , ; — or clause connections such as けど, から, し, a Japanese て-form, but, because, or and then
- Do not split inside a noun phrase, quotation/title, URL, or matched HTML tag pair
- An HTML tag boundary is not a reading-unit boundary. One unit may span multiple inline elements

Source and translation rules:
- Every unit source must be an exact and complete substring of the original HTML. Concatenating all unit sources in order must reproduce that input snippet exactly
- Preserve HTML tags in both source and translation
- Tokens such as ⟦1⟧ are placeholders for images or icons. Do not translate them; keep each token unchanged at the corresponding position in source and translation
- Translate each unit in the context of the entire snippet, and make the concatenated unit translations read naturally
- Do not translate URLs
- Return the same number of blocks as input

Example (one long sentence split into four clause units):
Input: [{"i":0,"html":"今日は朝から雨だったけど、傘を忘れたから、駅まで走って、なんとか電車に間に合った。"}]
Output: {"blocks":[{"i":0,"sentences":[{"source":"今日は朝から雨だったけど、","translation":"It had been raining since this morning, but "},{"source":"傘を忘れたから、","translation":"because I forgot my umbrella, "},{"source":"駅まで走って、","translation":"I ran to the station "},{"source":"なんとか電車に間に合った。","translation":"and somehow caught the train."}]}]}`,
      role: "system",
    },
    {
      content: JSON.stringify(indexedBlocks),
      role: "user",
    },
  ];
}

export interface Reconciliation {
  acceptedBlocks: Map<number, TranslationBlock>;
  duplicateIndices: number[];
  invalidIndices: number[];
  outOfRangeIndices: (number | null)[];
  missingIndices: number[];
  receivedCount: number;
}

interface RawBlock {
  i?: unknown;
  sentences?: unknown;
}

function isRawBlock(value: unknown): value is RawBlock {
  return typeof value === "object" && value !== null;
}

function isTranslationUnits(value: unknown): value is TranslationUnit[] {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }
  const items: unknown[] = value;
  return items.every(
    (item): item is TranslationUnit =>
      typeof item === "object" && item !== null && hasTranslationUnitShape(item),
  );
}

function hasTranslationUnitShape(value: object): boolean {
  const entries = new Map<string, unknown>(Object.entries(value));
  return (
    typeof entries.get("source") === "string" && typeof entries.get("translation") === "string"
  );
}

export function reconcileIndexedBlocks(
  rawBlocks: unknown,
  expectedIndices: readonly number[],
): Reconciliation {
  const expectedSet = new Set(expectedIndices);
  const blocks = Array.isArray(rawBlocks) ? rawBlocks.filter((b) => isRawBlock(b)) : [];
  const occurrenceCounts = new Map<number, number>();
  const firstBlocks = new Map<number, RawBlock>();
  const outOfRangeIndices: (number | null)[] = [];

  for (const block of blocks) {
    const index = block.i;
    if (typeof index !== "number" || !Number.isInteger(index) || !expectedSet.has(index)) {
      outOfRangeIndices.push(typeof index === "number" ? index : null);
      continue;
    }
    occurrenceCounts.set(index, (occurrenceCounts.get(index) ?? 0) + 1);
    if (!firstBlocks.has(index)) {
      firstBlocks.set(index, block);
    }
  }

  const acceptedBlocks = new Map<number, TranslationBlock>();
  const duplicateIndices: number[] = [];
  const invalidIndices: number[] = [];
  for (const index of expectedIndices) {
    const count = occurrenceCounts.get(index) ?? 0;
    const block = firstBlocks.get(index);
    if (count > 1) {
      duplicateIndices.push(index);
    } else if (count === 1 && isTranslationUnits(block?.sentences)) {
      acceptedBlocks.set(index, { sentences: block.sentences });
    } else if (count === 1) {
      invalidIndices.push(index);
    }
  }

  const missingIndices = expectedIndices.filter((index) => !acceptedBlocks.has(index));
  return {
    acceptedBlocks,
    duplicateIndices,
    invalidIndices,
    missingIndices,
    outOfRangeIndices,
    receivedCount: blocks.length,
  };
}

/** Validate that a resplit result rejoins to the original unit source. */
export function sourcesRejoin(
  sentences: ReadonlyArray<Readonly<TranslationUnit>> | undefined,
  source: string,
): boolean {
  if (!Array.isArray(sentences)) {
    return false;
  }
  const units: readonly TranslationUnit[] = sentences;
  return units.map((s: Readonly<TranslationUnit>) => s.source).join("") === source;
}
