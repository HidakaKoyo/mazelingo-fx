import type { MlgSpan } from "@/utils/dom-overlay";
import { cancelHoverTooltip, scheduleHoverTooltip, updateHoverAnchor } from "./hover";
import { scheduleTooltipHide } from "./tooltip";
import { scheduleTtsBtnHide, showTtsBtn } from "./tts";

export function bindInteractions(span: MlgSpan): void {
  if (span.dataset.mlgBound !== undefined && span.dataset.mlgBound !== "") {
    return;
  }
  span.dataset.mlgBound = "1";
  span.addEventListener("mouseenter", (event: MouseEvent) => {
    updateHoverAnchor(span, event);
    scheduleHoverTooltip(span);
    showTtsBtn(span, event);
  });
  span.addEventListener("mousemove", (event: MouseEvent) => {
    updateHoverAnchor(span, event);
  });
  span.addEventListener("mouseleave", () => {
    cancelHoverTooltip(span);
    scheduleTooltipHide();
    scheduleTtsBtnHide();
  });
}
