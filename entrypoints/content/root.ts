import { assignBlockDisplayLanguages } from "@/utils/content-logic";
import type { MlgSpan } from "@/utils/dom-overlay";
import { buildNormaKey } from "./blocks";
import { processLeafBlock } from "./block-hover";
import { STATE, findLeafBlocks, isRuntimeError, sendMessage } from "./state";
import { applyDefaultDisplay } from "./text";

export function processRoot(root: Node): void {
  if (!STATE.config.enabled) {
    return;
  }
  findLeafBlocks(root).forEach((block) => {
    processLeafBlock(block);
  });
  checkNormaCache();
}

function checkNormaCache(): void {
  const normaBlocks = document.querySelectorAll<HTMLElement>("[data-mlg-output='1']");
  if (normaBlocks.length === 0) {
    return;
  }
  const textKeys: string[] = [];
  const blockMap = new Map<string, HTMLElement[]>();
  normaBlocks.forEach((block) => {
    const key = buildNormaKey((block.textContent || "").trim());
    textKeys.push(key);
    const existing = blockMap.get(key);
    if (existing) {
      existing.push(block);
    } else {
      blockMap.set(key, [block]);
    }
  });
  void sendMessage<Record<string, boolean>>({
    payload: { textKeys },
    type: "mlg:normaCheck",
  }).then((result) => {
    if (result === undefined || isRuntimeError(result)) {
      return false;
    }
    const entries: [string, boolean][] = Object.entries(result);
    for (const [key, done] of entries) {
      if (done && blockMap.has(key)) {
        const blocks = blockMap.get(key);
        if (blocks) {
          blocks.forEach((block) => {
            delete block.dataset.mlgOutput;
          });
        }
      }
    }
    return true;
  });
}

export function refreshDisplay(preserveManual = false): void {
  const blocks = document.querySelectorAll("[data-mlg-block]");
  blocks.forEach((block) => {
    const spans = [...block.querySelectorAll<HTMLElement>("span[data-mlg-sentence]")];
    if (spans.length === 0) {
      return;
    }
    if (!preserveManual) {
      spans.forEach((span) => {
        delete span.dataset.mlgDisplay;
      });
    }
    const displays = assignBlockDisplayLanguages(
      spans,
      STATE.config.englishRatio,
      STATE.config.mixLanguage,
      location.href,
    );
    spans.forEach((span: MlgSpan, index: number) => {
      span.dataset.mlgDefaultDisplay = displays[index] ?? span.dataset.mlgLang ?? "en";
      applyDefaultDisplay(span);
    });
  });
}
