import type { FeedbackResult } from "@/utils/messages";
import { elements, escapeHtml } from "./el";
import { selectedTtsVoice, type DeepReadonly } from "./util";
import { getTranslations } from "./translations";
import { tts } from "./rpc";

let feedbackTtsCache: Record<string, string> = {};
let feedbackTtsPlaying: HTMLAudioElement | null = null;

export function resetFeedbackTts(): void {
  if (feedbackTtsPlaying !== null) {
    feedbackTtsPlaying.pause();
    feedbackTtsPlaying = null;
  }
  feedbackTtsCache = {};
}

async function playFeedbackTts(text: string): Promise<void> {
  if (feedbackTtsPlaying !== null) {
    feedbackTtsPlaying.pause();
    feedbackTtsPlaying = null;
  }
  if (feedbackTtsCache[text] !== undefined) {
    feedbackTtsPlaying = new Audio(feedbackTtsCache[text]);
    void feedbackTtsPlaying.play();
    return;
  }
  const res = await tts(text, selectedTtsVoice());
  if (res !== undefined && res.error === undefined && res.dataUrl !== undefined) {
    feedbackTtsCache[text] = res.dataUrl;
    feedbackTtsPlaying = new Audio(res.dataUrl);
    void feedbackTtsPlaying.play();
  }
}

function bindFeedbackTts(): void {
  resetFeedbackTts();
  elements.outputFeedback
    .querySelectorAll<HTMLButtonElement>(".feedback-tts-btn")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const text = btn.dataset.ttsText;
        if (text !== undefined && text !== "") {
          void playFeedbackTts(text);
        }
      });
    });
}

function buildFeedbackHtml(result: DeepReadonly<FeedbackResult>): string {
  const corrected = result.corrected;
  const feedback = result.feedback;
  const overall = result.overall;
  let html = "";

  if (corrected !== undefined && corrected !== "") {
    html += `<div class="feedback-corrected"><div class="feedback-corrected-row"><span class="feedback-corrected-text">${escapeHtml(corrected)}</span><button class="feedback-tts-btn" data-tts-text="${escapeHtml(corrected)}" title="再生">&#9655;</button></div></div>`;
  }

  if (feedback.length > 0) {
    html += `<div class="feedback-items">`;
    for (const item of feedback) {
      html += `<div class="feedback-item">`;
      html += `<div class="feedback-diff"><del>${escapeHtml(item.original)}</del> → <ins>${escapeHtml(item.corrected)}</ins></div>`;
      html += `<div class="feedback-explanation">${escapeHtml(item.explanation)}</div>`;
      html += `</div>`;
    }
    html += `</div>`;
  }

  if (overall !== undefined && overall !== "") {
    html += `<div class="feedback-overall">${escapeHtml(overall)}</div>`;
  }

  const alts = result.alternativeExamples ?? [];
  if (alts.length > 0) {
    const t = getTranslations();
    html += `<div class="feedback-alternatives">`;
    html += `<div class="feedback-alternatives-title">${escapeHtml(t.alternativeTitle)}</div>`;
    for (const alt of alts) {
      html += `<div class="modal-example">`;
      html += `<div class="feedback-alt-angle">${escapeHtml(alt.angle ?? "")}</div>`;
      html += `<div class="modal-example-row"><div class="modal-example-en">${escapeHtml(alt.en ?? "")}</div><button class="feedback-tts-btn" data-tts-text="${escapeHtml(alt.en ?? "")}" title="再生">&#9655;</button></div>`;
      html += `<div class="modal-example-ja">${escapeHtml(alt.ja ?? "")}</div>`;
      html += `</div>`;
    }
    html += `</div>`;
  }

  if (html === "") {
    const t = getTranslations();
    html = `<div class="feedback-perfect">${t.outputPerfect}</div>`;
  }
  return html;
}

export function renderFeedback(result: DeepReadonly<FeedbackResult>): void {
  elements.outputFeedback.innerHTML = buildFeedbackHtml(result);
  bindFeedbackTts();
}
