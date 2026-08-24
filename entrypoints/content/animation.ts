import { isMlgAtom } from "@/utils/dom-overlay";
import type { MlgSpan } from "@/utils/dom-overlay";
import {
  getOppositeLang,
  getShownLang,
  getVariantPlainText,
  isInteractiveEnabled,
  renderSpanDisplay,
} from "./text";
import { positionTooltip, updateTooltip } from "./tooltip-position";
import { STATE, TOGGLE_ANIMATION_MS } from "./state";

export function toggleSpanDisplay(span: MlgSpan): void {
  if (!isInteractiveEnabled()) {
    return;
  }
  const current = getShownLang(span);
  const next = getOppositeLang(current);
  span.dataset.mlgDisplay = next;
  runToggleAnimation(span, current, next);
}

function cancelSpanAnimation(span: MlgSpan): void {
  const anim = STATE.animations.get(span);
  if (anim) {
    cancelAnimationFrame(anim.rafId);
    STATE.animations.delete(span);
  }
}

function getAnimatedTextNodes(span: MlgSpan): Text[] {
  const textNodes: Text[] = [];
  const visit = (node: Node): void => {
    [...node.childNodes].forEach((child) => {
      if (child instanceof Text) {
        textNodes.push(child);
      } else if (child.nodeType === Node.ELEMENT_NODE && !isMlgAtom(child)) {
        visit(child);
      }
    });
  };
  visit(span);
  return textNodes;
}

function distributeAnimatedText(
  textNodes: readonly Text[],
  text: string,
  originalLengths: readonly number[],
): void {
  let cursor = 0;
  textNodes.forEach((node, index) => {
    const remaining = text.length - cursor;
    const take =
      index === textNodes.length - 1
        ? Math.max(0, remaining)
        : Math.min(Math.max(0, remaining), originalLengths[index] ?? 0);
    node.data = text.slice(cursor, cursor + take);
    cursor += take;
  });
}

export function runToggleAnimation(span: MlgSpan, fromLang: string, toLang: string): void {
  cancelSpanAnimation(span);
  const fromText = getVariantPlainText(span, fromLang);
  const toText = getVariantPlainText(span, toLang);
  const textNodes = getAnimatedTextNodes(span);
  if ((!fromText && !toText) || textNodes.length === 0) {
    span.dataset.mlgDisplay = toLang;
    renderSpanDisplay(span, toLang);
    return;
  }

  const originalLengths = textNodes.map((node) => node.data.length);
  span.dataset.mlgAnimating = "1";
  const start = performance.now();
  const duration = TOGGLE_ANIMATION_MS;
  const step = (now: number): void => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const toVisible = Math.floor(toText.length * progress);
    const fromVisible = Math.ceil(fromText.length * (1 - progress));
    const fromStart = Math.max(0, fromText.length - fromVisible);
    distributeAnimatedText(
      textNodes,
      toText.slice(0, toVisible) + fromText.slice(fromStart),
      originalLengths,
    );

    if (progress < 1) {
      const rafId = requestAnimationFrame(step);
      STATE.animations.set(span, { rafId });
    } else {
      delete span.dataset.mlgAnimating;
      span.dataset.mlgDisplay = toLang;
      renderSpanDisplay(span, toLang);
      STATE.animations.delete(span);
      if (STATE.tooltip?.currentSpan === span) {
        updateTooltip(span);
        positionTooltip(span);
      }
    }
  };
  const rafId = requestAnimationFrame(step);
  STATE.animations.set(span, { rafId });
}
