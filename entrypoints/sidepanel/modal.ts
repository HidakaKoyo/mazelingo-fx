import type { SuggestionItem, VocabAnalysis, VocabItem } from "@/utils/messages";
import { elements, escapeHtml } from "./el";
import { selectedTtsVoice, type DeepReadonly } from "./util";
import { getTranslations } from "./translations";
import { addVocab, getVocabItems } from "./vocab";
import { buildAnalysisHtml, isVocabAnalysis } from "./analysis";
import { tts } from "./rpc";

let currentModalWord = "";
let modalTtsCache: Record<string, string> = {};
let modalTtsPlaying: HTMLAudioElement | null = null;

function getCurrentModalWord(): string {
  return currentModalWord;
}

export { getCurrentModalWord };

function stopModalTts(): void {
  if (modalTtsPlaying !== null) {
    modalTtsPlaying.pause();
    modalTtsPlaying = null;
  }
}

async function playModalTts(text: string): Promise<void> {
  stopModalTts();
  if (modalTtsCache[text] !== undefined) {
    modalTtsPlaying = new Audio(modalTtsCache[text]);
    void modalTtsPlaying.play();
    return;
  }
  const res = await tts(text, selectedTtsVoice());
  if (res !== undefined && res.error === undefined && res.dataUrl !== undefined) {
    modalTtsCache[text] = res.dataUrl;
    modalTtsPlaying = new Audio(res.dataUrl);
    void modalTtsPlaying.play();
  }
}

function bindModalTts(): void {
  elements.modalContent.querySelectorAll<HTMLButtonElement>(".modal-tts-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const text = btn.dataset.text;
      if (text !== undefined && text !== "") {
        void playModalTts(text);
      }
    });
  });
}

export function renderAnalysis(data: DeepReadonly<VocabAnalysis>): void {
  const t = getTranslations();
  elements.modalContent.innerHTML = buildAnalysisHtml(data, getCurrentModalWord(), t);
  elements.modalContent.style.display = "";
  elements.modalAnalyzePrompt.style.display = "none";
  elements.modalReanalyzeBtn.textContent = t.modalReanalyze;
  elements.modalReanalyzeBtn.style.display = "";
  bindModalTts();
}

export function openVocabModal(word: string): void {
  currentModalWord = word;
  elements.modalTitle.textContent = word;
  elements.vocabModal.style.display = "";
  const t = getTranslations();
  elements.modalAnalyzeBtn.textContent = t.modalAnalyze;
  elements.modalAnalyzeBtn.disabled = false;

  const item = getVocabItems().find(
    (v: Readonly<VocabItem>) => v.en.toLowerCase() === word.toLowerCase(),
  );
  elements.reviewCount.textContent = String(item?.reviewCount ?? 0);
  if (item?.analysis !== undefined && isVocabAnalysis(item.analysis)) {
    renderAnalysis(item.analysis);
  } else {
    elements.modalAnalyzePrompt.style.display = "";
    elements.modalContent.style.display = "none";
    elements.modalContent.innerHTML = "";
    elements.modalReanalyzeBtn.style.display = "none";
  }
}

export function closeVocabModal(): void {
  stopModalTts();
  modalTtsCache = {};
  elements.vocabModal.style.display = "none";
  currentModalWord = "";
}

function buildSuggestionsHtml(suggestions: readonly DeepReadonly<SuggestionItem>[]): string {
  return suggestions
    .map(
      (s) => `<div class="vocab-suggest-item">
      <span class="vocab-suggest-text">
        <span class="vocab-suggest-en">${escapeHtml(s.en)}</span>
        <span class="vocab-suggest-ja">${escapeHtml(s.ja)}</span>
      </span>
      <button class="vocab-suggest-add" data-en="${escapeHtml(s.en)}" data-ja="${escapeHtml(s.ja)}">+</button>
    </div>`,
    )
    .join("");
}

function bindSuggestAdd(): void {
  elements.vocabSuggestList
    .querySelectorAll<HTMLButtonElement>(".vocab-suggest-add")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const en = btn.dataset.en ?? "";
        const ja = btn.dataset.ja ?? "";
        void addVocab(en, ja);
        btn.closest(".vocab-suggest-item")?.remove();
        if (elements.vocabSuggestList.children.length === 0) {
          elements.vocabSuggestSection.style.display = "none";
        }
      });
    });
}

export function renderVocabSuggestions(suggestions: readonly DeepReadonly<SuggestionItem>[]): void {
  if (suggestions.length === 0) {
    elements.vocabSuggestSection.style.display = "none";
    return;
  }
  elements.vocabSuggestSection.style.display = "";
  elements.vocabSuggestList.innerHTML = buildSuggestionsHtml(suggestions);
  bindSuggestAdd();
}
