import type { MlgSpan } from "@/utils/dom-overlay";
import type { TooltipState } from "./state";
import { STATE } from "./state";
import { toggleSpanDisplay } from "./animation";
import { positionTooltip, updateTooltip } from "./tooltip-position";
import { isInteractiveEnabled } from "./text";

function buildTooltipState(): TooltipState {
  const el = document.createElement("div");
  el.className = "mlg-tooltip notranslate";
  el.dataset.mlgTooltip = "1";
  el.setAttribute("translate", "no");
  el.setAttribute("role", "tooltip");
  const text = document.createElement("div");
  text.className = "mlg-tooltip-text";
  el.append(text);
  el.style.display = "none";
  el.addEventListener("mouseenter", () => {
    STATE.tooltipHover = true;
    clearTooltipHideTimer();
  });
  el.addEventListener("mouseleave", () => {
    STATE.tooltipHover = false;
    scheduleTooltipHide();
  });
  el.addEventListener("click", (event) => {
    event.stopPropagation();
    const current = STATE.tooltip?.currentSpan;
    if (!current) {
      return;
    }
    toggleSpanDisplay(current);
    STATE.tooltipHover = false;
    hideTooltip();
  });
  return { currentSpan: null, el, hideTimer: null, anchor: null, text };
}

export function ensureTooltip(): void {
  if (STATE.tooltip?.el) {
    return;
  }
  const tooltipState = buildTooltipState();
  document.body.append(tooltipState.el);
  STATE.tooltip = tooltipState;
  window.addEventListener(
    "scroll",
    () => {
      const current = STATE.tooltip?.currentSpan;
      if (current && tooltipState.el.style.display !== "none") {
        positionTooltip(current);
      }
    },
    { passive: true },
  );
  window.addEventListener("resize", () => {
    const current = STATE.tooltip?.currentSpan;
    if (current && tooltipState.el.style.display !== "none") {
      positionTooltip(current);
    }
  });
}

export function hideTooltip(): void {
  if (!STATE.tooltip?.el) {
    return;
  }
  STATE.tooltip.el.style.display = "none";
  STATE.tooltip.currentSpan = null;
}

export function clearTooltipHideTimer(): void {
  if (STATE.tooltip?.hideTimer) {
    clearTimeout(STATE.tooltip.hideTimer);
    STATE.tooltip.hideTimer = null;
  }
}

export function scheduleTooltipHide(): void {
  if (!STATE.tooltip?.el) {
    return;
  }
  clearTooltipHideTimer();
  STATE.tooltip.hideTimer = setTimeout(() => {
    if (!STATE.tooltipHover) {
      hideTooltip();
    }
  }, 120);
}

export function showTooltip(
  span: MlgSpan,
  anchor?: Readonly<{ x: number; y: number }> | null,
): void {
  if (!isInteractiveEnabled()) {
    return;
  }
  clearTooltipHideTimer();
  ensureTooltip();
  if (STATE.tooltip) {
    STATE.tooltip.currentSpan = span;
    if (anchor) {
      STATE.tooltip.anchor = anchor;
    }
  }
  updateTooltip(span);
  positionTooltip(span, anchor);
}
