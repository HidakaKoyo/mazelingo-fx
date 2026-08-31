import type { Language } from "@/utils/messages";
import type { DeepReadonly } from "@/utils/cache";
import { applyBlockTranslation } from "./apply";
import { createPendingBlock } from "./blocks";
import { processLeafBlock } from "./block-hover";
import { pauseAutomaticTranslation, resumeAutomaticTranslation } from "./observer";
import { refreshDisplay } from "./root";
import { STATE, findLeafBlocks, isPageAllowed, isRuntimeError, sendMessage } from "./state";
import type { MlgTranslateResponse, PendingBlock } from "./state";

let statusElement: HTMLDivElement | null = null;

function showStatus(message: string): void {
  if (statusElement?.isConnected !== true) {
    statusElement = document.createElement("div");
    statusElement.dataset.mlgReaderStatus = "1";
    statusElement.setAttribute("aria-live", "polite");
    statusElement.style.cssText =
      "position:fixed;right:16px;bottom:16px;z-index:2147483647;padding:8px 12px;border-radius:8px;background:#1f2937;color:#fff;font:13px/1.4 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.2)";
    document.body.append(statusElement);
  }
  statusElement.textContent = message;
}

function isReaderCurrent(runId: number, href: string): boolean {
  return (
    STATE.mode === "reader" &&
    STATE.runId === runId &&
    STATE.runHref === href &&
    location.href === href
  );
}

function isUntranslated(block: HTMLElement): boolean {
  return !block.querySelector("[data-mlg-sentence]");
}

function snapshotBlocks(): HTMLElement[] {
  const blocks = new Set<HTMLElement>();
  document.querySelectorAll<HTMLElement>("[data-mlg-block]").forEach((block) => {
    if (isUntranslated(block)) blocks.add(block);
  });
  findLeafBlocks(document.body).forEach((block) => {
    if (block instanceof HTMLElement) blocks.add(block);
  });
  return [...blocks].toSorted((a, b) =>
    a === b ? 0 : a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );
}

function prepareReaderBlock(block: HTMLElement): PendingBlock | null {
  if (block.dataset.mlgBlock !== "1") {
    processLeafBlock(block, false);
  }
  if (block.dataset.mlgBlock !== "1" || !isUntranslated(block)) return null;
  delete block.dataset.mlgFailed;
  delete block.dataset.mlgReaderFailed;
  delete block.dataset.mlgQueued;
  block.dataset.mlgTranslating = "1";
  return createPendingBlock(block, "reader");
}

function assemble(
  block: PendingBlock,
  response: DeepReadonly<MlgTranslateResponse>,
): { source: string; translation: string; isSeparator?: boolean }[] | null {
  const results = response.blocks;
  if (results === undefined || results === null || results.length < block.htmlParts.length) {
    return null;
  }
  const sentences: { source: string; translation: string; isSeparator?: boolean }[] = [];
  for (let index = 0; index < block.htmlParts.length; index += 1) {
    const result = results[index];
    const resultSentences = result?.sentences;
    if (resultSentences === undefined || resultSentences === null || resultSentences.length === 0) {
      return null;
    }
    sentences.push(...resultSentences);
    const separator = block.separators[index];
    if (separator !== undefined)
      sentences.push({ isSeparator: true, source: separator, translation: separator });
  }
  return sentences;
}

async function translateOne(block: PendingBlock, runId: number, href: string): Promise<boolean> {
  const to: Language = block.lang === "en" ? "ja" : "en";
  const response = await sendMessage<MlgTranslateResponse>({
    payload: { from: block.lang, htmlBlocks: block.htmlParts, to },
    type: "mlg:translate",
  });
  if (!isReaderCurrent(runId, href)) return false;
  if (response === undefined || isRuntimeError(response)) {
    markReaderFailure(block.element);
    return true;
  }
  const sentences = assemble(block, response);
  if (!sentences) {
    markReaderFailure(block.element);
    return true;
  }
  applyBlockTranslation(block.element, sentences, block.lang, block.atoms);
  return true;
}

async function translateBlocksSequentially(
  blocks: readonly PendingBlock[],
  runId: number,
  href: string,
  index = 0,
): Promise<void> {
  const block = blocks[index];
  if (!block) {
    if (isReaderCurrent(runId, href)) showStatus(`読書モード: ${blocks.length} 件完了`);
    return;
  }
  const translated = await translateOne(block, runId, href);
  if (!translated) return;
  showStatus(`読書モード: ${index + 1} / ${blocks.length}`);
  return translateBlocksSequentially(blocks, runId, href, index + 1);
}

function markReaderFailure(block: HTMLElement): void {
  delete block.dataset.mlgTranslating;
  block.dataset.mlgFailed = "1";
  block.dataset.mlgReaderFailed = "1";
}

export function startReaderMode(): void {
  if (!STATE.config.enabled || STATE.config.models.length === 0 || !isPageAllowed()) return;
  if (STATE.mode === "reader") {
    cancelReaderMode();
    return;
  }
  pauseAutomaticTranslation();
  STATE.mode = "reader";
  STATE.runId += 1;
  STATE.runHref = location.href;
  STATE.displayOverride = "ja";
  refreshDisplay(true);
  const runId = STATE.runId;
  const href = STATE.runHref;
  const blocks = snapshotBlocks()
    .map((block) => prepareReaderBlock(block))
    .filter((block): block is PendingBlock => block !== null);
  showStatus(`読書モード: 0 / ${blocks.length}`);
  void translateBlocksSequentially(blocks, runId, href);
}

export function cancelReaderMode(resetReusableBlocks = false): void {
  if (STATE.mode !== "reader") return;
  STATE.runId += 1;
  STATE.mode = "auto";
  STATE.displayOverride = null;
  showStatus("読書モードを停止しました");
  if (STATE.config.enabled && isPageAllowed()) {
    resumeAutomaticTranslation(resetReusableBlocks);
    refreshDisplay(true);
  }
}

export function cancelReaderForUrlChange(): void {
  cancelReaderMode(true);
}
