import { assignBlockDisplayLanguages, sanitizeHtmlFragment } from "@/utils/content-logic";
import { buildTokenStream, locateUnitRange, wrapRange } from "@/utils/dom-overlay";
import type { MlgSpan } from "@/utils/dom-overlay";
import { bindInteractions } from "./interactions";
import { hideTooltip } from "./tooltip";
import { applyDefaultDisplay } from "./text";
import { STATE } from "./state";

export interface SentenceBlock {
  source: string;
  translation?: string;
  isSeparator?: boolean;
}

function isMlgSentenceNode(node: Node): boolean {
  return node instanceof HTMLElement && node.dataset?.mlgSentence === "1";
}

function sentencePlainSource(sentence: Readonly<{ source: string }>): string {
  if (typeof sentence.source !== "string") {
    return "";
  }
  const parsed = new DOMParser().parseFromString(
    sanitizeHtmlFragment(sentence.source),
    "text/html",
  );
  return parsed.body.textContent ?? "";
}

function buildSentenceSpan(
  block: HTMLElement,
  sentence: Readonly<SentenceBlock>,
  sourceLang: string,
  fromIndex: number,
  atoms: Readonly<Map<number, Node>>,
): { span: MlgSpan; nextIndex: number } | null {
  const plainSource = sentencePlainSource(sentence);
  const currentStream = buildTokenStream(block, isMlgSentenceNode);
  const located = locateUnitRange(currentStream, plainSource, fromIndex);
  if (!located || !located.startContainer || !located.endContainer) {
    return null;
  }
  const range = document.createRange();
  range.setStart(located.startContainer, located.startOffset);
  range.setEnd(located.endContainer, located.endOffset);
  const span = wrapRange(range);
  span.dataset.mlgSentence = "1";
  span.dataset.mlgSource = plainSource;
  span.dataset.mlgTranslation =
    typeof sentence.translation === "string" ? sentence.translation : plainSource;
  span.dataset.mlgLang = sourceLang;
  span.mlgBlockAtoms = atoms;
  bindInteractions(span);
  return { span, nextIndex: located.nextIndex };
}

export function applyBlockTranslation(
  block: HTMLElement,
  sentences: readonly Readonly<SentenceBlock>[],
  sourceLang: string,
  retainedAtoms: Readonly<Map<number, Node>>,
): void {
  if (STATE.tooltip?.currentSpan === block) {
    hideTooltip();
  }
  const realSentences = sentences.filter((s) => s.isSeparator !== true);
  if (realSentences.length === 0) {
    delete block.dataset.mlgTranslating;
    block.dataset.mlgFailed = "1";
    return;
  }
  const stream = buildTokenStream(block, isMlgSentenceNode);
  const streamAtoms = new Map(
    stream
      .filter((token) => token.type === "atom")
      .map((token) => [token.atomNumber ?? -1, token.node]),
  );
  const atoms = retainedAtoms instanceof Map ? retainedAtoms : streamAtoms;
  const sentenceSpans = buildSentenceSpans(block, realSentences, sourceLang, atoms);
  if (sentenceSpans.length === 0) {
    delete block.dataset.mlgTranslating;
    block.dataset.mlgFailed = "1";
    return;
  }
  const displays = assignBlockDisplayLanguages(
    sentenceSpans,
    STATE.config.englishRatio,
    STATE.config.mixLanguage,
    location.href,
  );
  sentenceSpans.forEach((span, index) => {
    span.dataset.mlgDefaultDisplay = displays[index] ?? span.dataset.mlgLang ?? "en";
    applyDefaultDisplay(span);
  });
  delete block.dataset.mlgTranslating;
}

function buildSentenceSpans(
  block: HTMLElement,
  realSentences: readonly Readonly<SentenceBlock>[],
  sourceLang: string,
  atoms: Readonly<Map<number, Node>>,
): MlgSpan[] {
  const sentenceSpans: MlgSpan[] = [];
  let fromIndex = 0;
  for (let sentenceIndex = 0; sentenceIndex < realSentences.length; sentenceIndex += 1) {
    const sentence = realSentences[sentenceIndex];
    if (!sentence) {
      continue;
    }
    const built = buildSentenceSpan(block, sentence, sourceLang, fromIndex, atoms);
    if (!built) {
      break;
    }
    sentenceSpans.push(built.span);
    fromIndex = built.nextIndex;
  }
  return sentenceSpans;
}
