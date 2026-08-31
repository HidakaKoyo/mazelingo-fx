import type { MlgSpan } from "@/utils/dom-overlay";
import { hideTooltip } from "./tooltip";
import { STATE, hasBlockedAncestor, isPageAllowed } from "./state";
import { processRoot, refreshDisplay } from "./root";
import { resumeUntranslatedBlocks, startIntersectionObserver } from "./blocks";
import { renderSpanDisplay } from "./text";
import { cancelReaderForUrlChange } from "./reader";

let lastSeenUrl = "";

/** Makes raw DOM reused by an SPA eligible for discovery on the new URL. */
export function resetReusableBlocksForUrlChange(): void {
  document.querySelectorAll<HTMLElement>("[data-mlg-block='1']").forEach((block) => {
    if (block.querySelector("[data-mlg-sentence]")) {
      return;
    }
    delete block.dataset.mlgBlock;
    delete block.dataset.mlgFailed;
    delete block.dataset.mlgOutput;
    delete block.dataset.mlgQueued;
    delete block.dataset.mlgReaderFailed;
    delete block.dataset.mlgTranslating;
  });
}

export function startObserver(): void {
  if (STATE.observer) {
    return;
  }
  STATE.observer = new MutationObserver((mutations) => {
    evaluatePageForCurrentUrl();
    const nodes = new Set<Node>();
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          nodes.add(node);
        }
      });
    });
    nodes.forEach((node) => {
      if (node instanceof Element && !hasBlockedAncestor(node)) {
        processRoot(node);
      }
    });
  });
  STATE.observer.observe(document.body, { childList: true, subtree: true });
}

export function stopObserver(): void {
  if (STATE.observer) {
    STATE.observer.disconnect();
    STATE.observer = null;
  }
}

export function start(): void {
  if (STATE.started) {
    return;
  }
  resumeAutomaticTranslation();
}

export function resumeAutomaticTranslation(resetReusableBlocks = false): void {
  STATE.mode = "auto";
  STATE.runId += 1;
  STATE.runHref = location.href;
  lastSeenUrl = location.href;
  STATE.started = true;
  startIntersectionObserver();
  if (resetReusableBlocks) {
    resetReusableBlocksForUrlChange();
  }
  resumeUntranslatedBlocks();
  processRoot(document.body);
  startObserver();
}

export function pauseAutomaticTranslation(): void {
  STATE.runId += 1;
  stopObserver();
  if (STATE.intersectionObserver) {
    STATE.intersectionObserver.disconnect();
    STATE.intersectionObserver = null;
  }
  if (STATE.blockTranslateTimer) {
    clearTimeout(STATE.blockTranslateTimer);
    STATE.blockTranslateTimer = null;
  }
  STATE.pendingBlocks = [];
}

export function stop(): void {
  pauseAutomaticTranslation();
  STATE.displayOverride = null;
  STATE.mode = "auto";
  const spans = document.querySelectorAll<HTMLElement>("span[data-mlg-sentence]");
  spans.forEach((span: MlgSpan) => {
    renderSpanDisplay(span, span.dataset.mlgLang ?? "en");
  });
  hideTooltip();
  STATE.started = false;
}

export function evaluatePageForCurrentUrl(): void {
  if (location.href === lastSeenUrl) {
    return;
  }
  lastSeenUrl = location.href;
  const wasReader = STATE.mode === "reader";
  const wasStarted = STATE.started;
  const shouldTranslate = STATE.config.enabled && isPageAllowed();
  if (wasReader) {
    cancelReaderForUrlChange();
  } else if (wasStarted) {
    pauseAutomaticTranslation();
    if (shouldTranslate) {
      resumeAutomaticTranslation(true);
    }
  }
  if (shouldTranslate && !wasReader && !wasStarted) {
    start();
    refreshDisplay(wasReader);
  } else if (!shouldTranslate && STATE.started) {
    stop();
  } else if (shouldTranslate) {
    refreshDisplay(wasReader);
  }
}

export function watchUrlChanges(): void {
  lastSeenUrl = location.href;
  window.addEventListener("popstate", evaluatePageForCurrentUrl);
  window.addEventListener("hashchange", evaluatePageForCurrentUrl);
  setInterval(evaluatePageForCurrentUrl, 1000);
}
