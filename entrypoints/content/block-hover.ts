import { hashString } from "@/utils/content-logic";
import { ensureTooltip, hideTooltip } from "./tooltip";
import { positionTooltip } from "./tooltip-position";
import { STATE, hasBlockedAncestor, RETRY_COUNTDOWN_MS, sendMessage } from "./state";
import { isBlockPending, retryBlock } from "./blocks";

const retryTimers = new WeakMap<
  HTMLElement,
  { retryId: ReturnType<typeof setTimeout>; countdownId: ReturnType<typeof setInterval> }
>();

function clearRetryTimers(block: HTMLElement): void {
  const timers = retryTimers.get(block);
  if (timers) {
    clearTimeout(timers.retryId);
    clearInterval(timers.countdownId);
    retryTimers.delete(block);
  }
}

function renderRetryCountdown(
  block: HTMLElement,
  anchor: Readonly<{ x: number; y: number }>,
  startTime: number,
): void {
  const remaining = Math.max(0, Math.ceil((RETRY_COUNTDOWN_MS - (Date.now() - startTime)) / 1000));
  const textEl = STATE.tooltip?.text;
  if (textEl) {
    textEl.textContent = `Translation failed. Retrying in ${remaining}s...`;
  }
  positionTooltip(block, anchor);
}

function startRetryCountdown(block: HTMLElement, anchor: Readonly<{ x: number; y: number }>): void {
  clearRetryTimers(block);
  const startTime = Date.now();
  ensureTooltip();
  if (STATE.tooltip) {
    STATE.tooltip.currentSpan = block;
    STATE.tooltip.anchor = anchor;
  }
  renderRetryCountdown(block, anchor, startTime);
  const countdownId = setInterval(() => {
    renderRetryCountdown(block, anchor, startTime);
  }, 200);
  const retryId = setTimeout(() => {
    clearRetryTimers(block);
    hideTooltip();
    retryBlock(block);
  }, RETRY_COUNTDOWN_MS);
  retryTimers.set(block, { countdownId, retryId });
}

function startRetryStatus(block: HTMLElement, anchor: Readonly<{ x: number; y: number }>): void {
  clearRetryTimers(block);
  ensureTooltip();
  if (STATE.tooltip) {
    STATE.tooltip.text.textContent = "Translating...";
    STATE.tooltip.currentSpan = block;
    STATE.tooltip.anchor = anchor;
  }
  positionTooltip(block, anchor);
}

function bindBlockHover(block: HTMLElement): void {
  block.addEventListener("mouseenter", (event: MouseEvent) => {
    if (!isBlockPending(block)) {
      return;
    }
    const anchor = { x: event.clientX, y: event.clientY };
    if (block.dataset.mlgFailed === "1") {
      startRetryCountdown(block, anchor);
    } else {
      startRetryStatus(block, anchor);
    }
  });
  block.addEventListener("mousemove", (event: MouseEvent) => {
    if (!isBlockPending(block)) {
      return;
    }
    if (STATE.tooltip?.currentSpan === block) {
      const anchor = { x: event.clientX, y: event.clientY };
      STATE.tooltip.anchor = anchor;
      positionTooltip(block, anchor);
    }
  });
  block.addEventListener("mouseleave", () => {
    clearRetryTimers(block);
    if (STATE.tooltip?.currentSpan === block) {
      hideTooltip();
    }
  });
}

function positionWrapButton(wrap: HTMLElement, block: Element): void {
  const rect = block.getBoundingClientRect();
  wrap.style.top = `${rect.top + window.scrollY + 2}px`;
  wrap.style.left = `${rect.right + window.scrollX - 26}px`;
}

function addEditButton(block: Element): void {
  const wrap = document.createElement("div");
  wrap.className = "mlg-edit-btn-wrap";
  wrap.dataset.mlgTooltip = "1";
  const btn = document.createElement("button");
  btn.className = "mlg-edit-btn";
  btn.setAttribute("aria-label", "Edit");
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="M15 5l4 4"/></svg>`;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    const text = block.textContent ?? "";
    void sendMessage({
      payload: { origin: location.origin, text: text.trim() },
      type: "mlg:openOutput",
    });
  });
  wrap.append(btn);
  const show = (): void => {
    positionWrapButton(wrap, block);
    wrap.classList.add("is-visible");
  };
  block.addEventListener("mouseenter", show);
  block.addEventListener("mouseleave", () => {
    setTimeout(() => {
      if (!wrap.matches(":hover")) {
        wrap.classList.remove("is-visible");
      }
    }, 100);
  });
  wrap.addEventListener("mouseenter", () => {
    positionWrapButton(wrap, block);
    wrap.classList.add("is-visible");
  });
  wrap.addEventListener("mouseleave", () => {
    wrap.classList.remove("is-visible");
  });
  document.body.append(wrap);
}

function shouldMarkOutput(text: string): boolean {
  const ratio = Math.max(0, Math.min(100, STATE.config.outputRatio));
  if (ratio === 0) {
    return false;
  }
  if (ratio === 100) {
    return true;
  }
  return hashString(`output::${location.href}::${text}`) % 100 < ratio;
}

export function processLeafBlock(block: Element): void {
  if (!(block instanceof HTMLElement)) {
    return;
  }
  if (block.dataset.mlgBlock === "1") {
    return;
  }
  if (hasBlockedAncestor(block)) {
    return;
  }
  const text = block.textContent ?? "";
  if (!text.trim() || text.trim().length < STATE.config.minTextLength) {
    return;
  }
  block.dataset.mlgBlock = "1";
  block.dataset.mlgTranslating = "1";
  if (shouldMarkOutput(text.trim())) {
    block.dataset.mlgOutput = "1";
  }
  addEditButton(block);
  bindBlockHover(block);
  const io = STATE.intersectionObserver;
  if (io) {
    io.observe(block);
  }
}
