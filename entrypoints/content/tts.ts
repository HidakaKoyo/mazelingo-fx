import { stripHtmlTags } from "@/utils/content-logic";
import type { MlgSpan } from "@/utils/dom-overlay";
import { getEnglishText, getJapaneseText, getSourceLang } from "./text";
import { sendMessage } from "./state";
import { closeTtsPopup, openTtsPopup } from "./tts-popup";
import { TTS_SPEAKER_SVG, tts } from "./tts-state";
import { HOVER_ACTIVATION_MS } from "./state";

export function showTtsBtn(span: MlgSpan, _event: Event): void {
  if (tts.hoverActions?.matches(":hover") === true) {
    return;
  }
  clearTtsBtnHide();
  if (tts.showTimer) {
    clearTimeout(tts.showTimer);
  }
  tts.showTimer = setTimeout(() => {
    tts.showTimer = null;
    showTtsBtnImmediate(span);
  }, HOVER_ACTIVATION_MS);
}

function showTtsBtnImmediate(span: MlgSpan): void {
  if (!tts.hoverActions) {
    tts.hoverActions = document.createElement("div");
    tts.hoverActions.className = "mlg-hover-actions notranslate";
    tts.hoverActions.setAttribute("translate", "no");

    tts.btn = document.createElement("button");
    tts.btn.className = "mlg-tts-btn";
    tts.btn.type = "button";
    tts.btn.title = "音声を再生";
    tts.btn.innerHTML = TTS_SPEAKER_SVG;
    tts.btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (tts.btnSpan) {
        openTtsPopup(tts.btnSpan);
      }
    });

    const explainBtn = document.createElement("button");
    explainBtn.className = "mlg-explain-btn";
    explainBtn.type = "button";
    explainBtn.title = "文法解説";
    explainBtn.textContent = "解説";
    explainBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (tts.btnSpan) {
        openExplanation(tts.btnSpan);
      }
    });

    tts.hoverActions.addEventListener("mouseenter", () => {
      clearTtsBtnHide();
    });
    tts.hoverActions.addEventListener("mouseleave", () => {
      scheduleTtsBtnHide();
    });
    tts.hoverActions.append(tts.btn);
    tts.hoverActions.append(explainBtn);
    document.body.append(tts.hoverActions);
  }
  tts.btnSpan = span;
  const rects = span.getClientRects();
  const rect =
    rects.length > 0 ? (rects[0] ?? span.getBoundingClientRect()) : span.getBoundingClientRect();
  tts.hoverActions.style.top = `${rect.top + window.scrollY + (rect.height - 22) / 2}px`;
  tts.hoverActions.style.left = `${rect.left + window.scrollX - 42}px`;
  tts.hoverActions.classList.add("is-visible");
}

export function hideTtsBtn(): void {
  if (tts.showTimer) {
    clearTimeout(tts.showTimer);
    tts.showTimer = null;
  }
  if (tts.hoverActions) {
    tts.hoverActions.classList.remove("is-visible");
  }
  tts.btnSpan = null;
}

export function scheduleTtsBtnHide(): void {
  clearTtsBtnHide();
  tts.hideTimer = setTimeout(() => {
    if (tts.hoverActions?.matches(":hover") !== true) {
      hideTtsBtn();
    }
  }, 300);
}

export function clearTtsBtnHide(): void {
  if (tts.hideTimer) {
    clearTimeout(tts.hideTimer);
    tts.hideTimer = null;
  }
}

export function openExplanation(span: MlgSpan): void {
  closeTtsPopup();
  const sourceLang = getSourceLang(span);
  const sourceText = stripHtmlTags(span.dataset.mlgSource ?? span.textContent ?? "").trim();
  const translationText = stripHtmlTags(span.dataset.mlgTranslation ?? "").trim();
  const englishText = stripHtmlTags(getEnglishText(span)).trim();
  const japaneseText =
    sourceLang === "ja"
      ? sourceText
      : translationText || stripHtmlTags(getJapaneseText(span)).trim();
  const text = englishText || sourceText;
  if (!text) {
    return;
  }
  hideTtsBtn();
  void sendMessage({
    payload: {
      englishText,
      japaneseText,
      origin: location.origin,
      pageUrl: location.href,
      sourceLang,
      sourceText,
      text,
    },
    type: "mlg:openExplanation",
  });
}
