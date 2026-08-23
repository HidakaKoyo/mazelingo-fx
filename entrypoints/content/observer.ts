import type { MlgSpan } from "@/utils/dom-overlay";
import { hideTooltip } from "./tooltip";
import { STATE, hasBlockedAncestor, isPageAllowed } from "./state";
import { processRoot, refreshDisplay } from "./root";
import { startIntersectionObserver } from "./blocks";
import { renderSpanDisplay } from "./text";

let lastSeenUrl = "";

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
  STATE.started = true;
  startIntersectionObserver();
  processRoot(document.body);
  startObserver();
}

export function stop(): void {
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
  const shouldTranslate = STATE.config.enabled && isPageAllowed();
  if (shouldTranslate && !STATE.started) {
    start();
    refreshDisplay();
  } else if (!shouldTranslate && STATE.started) {
    stop();
  }
}

export function watchUrlChanges(): void {
  window.addEventListener("popstate", evaluatePageForCurrentUrl);
  window.addEventListener("hashchange", evaluatePageForCurrentUrl);
  setInterval(evaluatePageForCurrentUrl, 1000);
}
