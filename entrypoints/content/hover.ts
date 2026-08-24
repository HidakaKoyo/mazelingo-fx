import type { MlgSpan } from "@/utils/dom-overlay";
import { showTooltip } from "./tooltip";
import { clearTooltipHideTimer } from "./tooltip";
import { positionTooltip } from "./tooltip-position";
import { STATE, HOVER_ACTIVATION_MS } from "./state";
import { isInteractiveEnabled } from "./text";

export function updateHoverAnchor(span: MlgSpan, event: MouseEvent): void {
  const point = { x: event.clientX, y: event.clientY };
  STATE.hoverAnchors.set(span, point);
  if (STATE.tooltip?.currentSpan === span && STATE.tooltip.el.style.display !== "none") {
    positionTooltip(span, point);
  }
}

export function scheduleHoverTooltip(span: MlgSpan): void {
  if (!isInteractiveEnabled()) {
    return;
  }
  cancelHoverTooltip(span);
  clearTooltipHideTimer();
  const timerId = setTimeout(() => {
    const anchor = STATE.hoverAnchors.get(span);
    if (!span.isConnected || !span.matches(":hover")) {
      return;
    }
    showTooltip(span, anchor);
  }, HOVER_ACTIVATION_MS);
  STATE.hoverTimers.set(span, timerId);
}

export function cancelHoverTooltip(span: MlgSpan): void {
  const timerId = STATE.hoverTimers.get(span);
  if (timerId) {
    clearTimeout(timerId);
    STATE.hoverTimers.delete(span);
  }
}
