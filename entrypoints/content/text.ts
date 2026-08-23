import { sanitizeHtmlFragment, stripHtmlTags } from "@/utils/content-logic";
import { renderOriginal, renderVariant } from "@/utils/dom-overlay";
import type { MlgSpan } from "@/utils/dom-overlay";
import { STATE, isPageAllowed } from "./state";

export function getEnglishText(span: MlgSpan): string {
  const source = span.dataset.mlgSource ?? "";
  const translation = span.dataset.mlgTranslation ?? "";
  const sourceLang = span.dataset.mlgLang ?? "en";
  if (sourceLang === "en") {
    return source;
  }
  return translation || source;
}

export function getJapaneseText(span: MlgSpan): string {
  const source = span.dataset.mlgSource ?? "";
  const translation = span.dataset.mlgTranslation ?? "";
  const sourceLang = span.dataset.mlgLang ?? "en";
  if (sourceLang === "ja") {
    return source;
  }
  return translation || source;
}

export function getSourceLang(span: MlgSpan): string {
  return span.dataset.mlgLang ?? "en";
}

export function getOppositeLang(lang: string): string {
  return lang === "en" ? "ja" : "en";
}

export function getDesiredDisplay(span: MlgSpan): string {
  const manual = span.dataset.mlgDisplay;
  if (manual === "en" || manual === "ja") {
    return manual;
  }
  return span.dataset.mlgDefaultDisplay ?? span.dataset.mlgLang ?? "en";
}

export function getShownLang(span: MlgSpan): string {
  return span.dataset.mlgShown ?? getSourceLang(span);
}

export function getVariantPlainText(span: MlgSpan, lang: string): string {
  const html = lang === "en" ? getEnglishText(span) : getJapaneseText(span);
  return stripHtmlTags(html);
}

export function renderSpanDisplay(span: MlgSpan, lang: string): void {
  const sourceLang = getSourceLang(span);
  const hasTranslation =
    typeof span.dataset.mlgTranslation === "string" && span.dataset.mlgTranslation.length > 0;
  if (lang === sourceLang || !hasTranslation) {
    renderOriginal(span);
    span.dataset.mlgShown = sourceLang;
  } else {
    renderVariant(
      span,
      sanitizeHtmlFragment(span.dataset.mlgTranslation ?? ""),
      span.mlgBlockAtoms ?? undefined,
    );
    span.dataset.mlgShown = lang;
  }
}

export function applyDefaultDisplay(span: MlgSpan): void {
  if (span.dataset.mlgAnimating === "1") {
    return;
  }
  const { config } = STATE;
  if (!config.enabled) {
    renderSpanDisplay(span, getSourceLang(span));
    return;
  }
  renderSpanDisplay(span, getDesiredDisplay(span));
}

export function isInteractiveEnabled(): boolean {
  return STATE.config.enabled && isPageAllowed();
}
