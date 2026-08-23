import { stripHtmlTags } from "@/utils/content-logic";
import type { MlgSpan } from "@/utils/dom-overlay";
import { getEnglishText, getJapaneseText, getOppositeLang, getShownLang } from "./text";
import { STATE } from "./state";

export function getTooltipText(span: MlgSpan): string {
  const current = getShownLang(span);
  const other = getOppositeLang(current);
  const html = other === "en" ? getEnglishText(span) : getJapaneseText(span);
  return stripHtmlTags(html);
}

export function updateTooltip(span: MlgSpan): void {
  if (!STATE.tooltip?.text) {
    return;
  }
  STATE.tooltip.text.textContent = getTooltipText(span);
}

export function positionTooltip(
  span: MlgSpan,
  anchor?: Readonly<{ x: number; y: number }> | null,
): void {
  if (!STATE.tooltip?.el) {
    return;
  }
  const tooltip = STATE.tooltip.el;
  const point = anchor ?? STATE.tooltip.anchor;
  if (!point) {
    return;
  }
  const margin = 8;
  const gap = 15;
  tooltip.style.maxWidth = `${Math.min(360, window.innerWidth - margin * 2)}px`;
  tooltip.style.visibility = "hidden";
  tooltip.style.display = "block";
  const tooltipRect = tooltip.getBoundingClientRect();
  const anchorX = point.x;
  const anchorY = point.y;
  let top = anchorY - tooltipRect.height - gap;
  top = Math.max(margin, top);
  let left = anchorX - tooltipRect.width / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - tooltipRect.width - margin));
  const arrowLeft = Math.max(12, Math.min(Math.round(anchorX - left), tooltipRect.width - 12));
  tooltip.style.top = `${Math.round(top)}px`;
  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.dataset.placement = "top";
  tooltip.style.setProperty("--mlg-tooltip-arrow-left", `${arrowLeft}px`);
  tooltip.style.visibility = "visible";
}
