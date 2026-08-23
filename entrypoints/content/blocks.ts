import {
  cleanHtmlForTranslation,
  detectLang,
  hasTranslatableText,
  serializeCleanPart,
  splitHtmlByLineBreaks,
} from "@/utils/content-logic";
import type { Language } from "@/utils/messages";
import { applyBlockTranslation } from "./apply";
import {
  MAX_BLOCKS_PER_BATCH,
  MAX_CONCURRENT_BATCHES,
  STATE,
  isPageAllowed,
  isRuntimeError,
  sendMessage,
} from "./state";
import type { PendingBlock, MlgTranslateResponse } from "./state";
import type { DeepReadonly } from "@/utils/cache";

interface RetMapping {
  allParts: string[];
  blockMapping: { blockIndex: number; partCount: number }[];
}

export function isBlockPending(block: HTMLElement): boolean {
  return block.dataset.mlgTranslating === "1" || block.dataset.mlgFailed === "1";
}

export function retryBlock(block: HTMLElement): void {
  delete block.dataset.mlgFailed;
  block.dataset.mlgTranslating = "1";
  enqueueBlock(block);
}

function enqueueBlock(block: HTMLElement): void {
  if (!block.isConnected || block.dataset.mlgTranslating !== "1") {
    return;
  }
  const lang = detectLang(block.textContent);
  const cleaned = cleanHtmlForTranslation(block);
  if (!hasTranslatableText(cleaned.html)) {
    delete block.dataset.mlgTranslating;
    return;
  }
  const { parts, separators } = splitHtmlByLineBreaks(cleaned.clone.innerHTML);
  const cleanParts = parts.map((part) => serializeCleanPart(part));
  STATE.pendingBlocks.push({
    atoms: cleaned.atoms,
    element: block,
    htmlParts: cleanParts,
    lang,
    separators,
  });
  queueBlockTranslate();
}

export function startIntersectionObserver(): void {
  if (STATE.intersectionObserver) {
    return;
  }
  STATE.intersectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        const block = entry.target;
        if (!(block instanceof HTMLElement) || block.dataset.mlgQueued === "1") {
          return;
        }
        block.dataset.mlgQueued = "1";
        STATE.intersectionObserver?.unobserve(block);
        enqueueBlock(block);
      });
    },
    { rootMargin: "1000px" },
  );
}

function queueBlockTranslate(): void {
  if (STATE.blockTranslateTimer !== null) {
    clearTimeout(STATE.blockTranslateTimer);
  }
  STATE.blockTranslateTimer = setTimeout(() => {
    STATE.blockTranslateTimer = null;
    translatePendingBlocks().catch((error) => {
      console.error("[mlg:cs] translatePendingBlocks error:", error);
    });
  }, 200);
}

async function translatePendingBlocks(): Promise<void> {
  if (!STATE.config.enabled || STATE.config.models.length === 0 || !isPageAllowed()) {
    STATE.pendingBlocks = [];
    return;
  }
  const pending = STATE.pendingBlocks.splice(0);
  if (pending.length === 0) {
    return;
  }
  const enBlocks = pending.filter((b) => b.lang === "en");
  const jaBlocks = pending.filter((b) => b.lang === "ja");
  await Promise.all([
    enBlocks.length > 0 ? translateBlockGroup(enBlocks, "en", "ja") : Promise.resolve(),
    jaBlocks.length > 0 ? translateBlockGroup(jaBlocks, "ja", "en") : Promise.resolve(),
  ]);
}

async function translateBlockGroup(
  blocks: readonly PendingBlock[],
  from: Language,
  to: Language,
): Promise<void> {
  const batches: PendingBlock[][] = [];
  for (let i = 0; i < blocks.length; i += MAX_BLOCKS_PER_BATCH) {
    batches.push(blocks.slice(i, i + MAX_BLOCKS_PER_BATCH));
  }
  const chunkPromises: Promise<void[]>[] = [];
  for (let i = 0; i < batches.length; i += MAX_CONCURRENT_BATCHES) {
    const chunk = batches.slice(i, i + MAX_CONCURRENT_BATCHES);
    chunkPromises.push(Promise.all(chunk.map((batch) => translateBlockBatch(batch, from, to))));
  }
  await Promise.all(chunkPromises);
}

function collectBatchParts(blocks: readonly PendingBlock[]): RetMapping {
  const allParts: string[] = [];
  const blockMapping: { blockIndex: number; partCount: number }[] = [];
  blocks.forEach((b, i) => {
    blockMapping.push({ blockIndex: i, partCount: b.htmlParts.length });
    allParts.push(...b.htmlParts);
  });
  return { allParts, blockMapping };
}

async function translateBlockBatch(
  blocks: readonly PendingBlock[],
  from: Language,
  to: Language,
): Promise<void> {
  const { allParts, blockMapping } = collectBatchParts(blocks);
  const response = await sendMessage<MlgTranslateResponse>({
    payload: { from, htmlBlocks: allParts, to },
    type: "mlg:translate",
  });
  if (response === undefined || isRuntimeError(response)) {
    if (blocks[0]?.retried !== true) {
      blocks.forEach((b) => {
        b.retried = true;
      });
      await translateBlockBatch(blocks, from, to);
      return;
    }
    blocks.forEach((b) => {
      delete b.element.dataset.mlgTranslating;
      b.element.dataset.mlgFailed = "1";
    });
    return;
  }
  applyBatchResults(blocks, blockMapping, response.blocks ?? [], from);
}

function findFailedParts(
  partOffset: number,
  partCount: number,
  resultBlocks: readonly DeepReadonly<NonNullable<MlgTranslateResponse["blocks"]>[number]>[],
): number[] {
  const failed: number[] = [];
  for (let p = 0; p < partCount; p += 1) {
    const resultIndex = partOffset + p;
    const resultBlock = resultBlocks[resultIndex];
    if (
      !resultBlock ||
      !Array.isArray(resultBlock.sentences) ||
      resultBlock.sentences.length === 0
    ) {
      failed.push(resultIndex);
    }
  }
  return failed;
}

function assembleSentences(
  partOffset: number,
  partCount: number,
  separators: readonly string[],
  resultBlocks: readonly DeepReadonly<NonNullable<MlgTranslateResponse["blocks"]>[number]>[],
): { source: string; translation: string; isSeparator?: boolean }[] {
  const sentences: { source: string; translation: string; isSeparator?: boolean }[] = [];
  for (let p = 0; p < partCount; p += 1) {
    const rb = resultBlocks[partOffset + p];
    if (rb?.sentences) {
      sentences.push(...rb.sentences);
    }
    if (p < partCount - 1 && p < separators.length) {
      const sep = separators[p];
      if (sep !== undefined) {
        sentences.push({ isSeparator: true, source: sep, translation: sep });
      }
    }
  }
  return sentences;
}

function applyBatchResults(
  blocks: readonly PendingBlock[],
  blockMapping: readonly Readonly<{ blockIndex: number; partCount: number }>[],
  resultBlocks: readonly DeepReadonly<NonNullable<MlgTranslateResponse["blocks"]>[number]>[],
  from: Language,
): void {
  let offset = 0;
  blockMapping.forEach(({ blockIndex, partCount }) => {
    const block = blocks[blockIndex];
    const partOffset = offset;
    offset += partCount;
    if (!block || !block.element.isConnected) {
      return;
    }
    const failedPartIndices = findFailedParts(partOffset, partCount, resultBlocks);
    if (failedPartIndices.length > 0) {
      delete block.element.dataset.mlgTranslating;
      block.element.dataset.mlgFailed = "1";
      return;
    }
    const sentences = assembleSentences(partOffset, partCount, block.separators, resultBlocks);
    applyBlockTranslation(block.element, sentences, from, block.atoms);
  });
}

export function buildNormaKey(text: string): string {
  return `${location.origin}::${text}`;
}
