import type { VocabItem } from "@/utils/messages";
import { elements, escapeHtml } from "./el";
import { getTranslations } from "./translations";
import { closeVocabModal, getCurrentModalWord, openVocabModal, renderAnalysis } from "./modal";
import {
  addVocab,
  getVocabItems,
  loadVocab,
  renderVocabList,
  setVocabItems,
  setVocabOpenHandler,
} from "./vocab";
import { addMyExample, loadMyExamples } from "./myexamples";
import { analyzeVocab as analyzeVocabRpc, updateVocab } from "./rpc";

async function updateReviewCount(delta: number): Promise<void> {
  const word = getCurrentModalWord();
  if (word === "") {
    return;
  }
  const item = getVocabItems().find(
    (v: Readonly<VocabItem>) => v.en.toLowerCase() === word.toLowerCase(),
  );
  if (item === undefined) {
    return;
  }
  const newCount = Math.max(0, (item.reviewCount ?? 0) + delta);
  const resp = await updateVocab(word, { reviewCount: newCount });
  if (resp !== undefined) {
    setVocabItems(resp);
    elements.reviewCount.textContent = String(newCount);
    renderVocabList();
  }
}

async function runAnalysis(): Promise<void> {
  const word = getCurrentModalWord();
  if (word === "") {
    return;
  }
  const t = getTranslations();
  elements.modalAnalyzeBtn.disabled = true;
  elements.modalAnalyzeBtn.textContent = t.modalAnalyzing;
  elements.modalReanalyzeBtn.style.display = "none";
  elements.modalContent.innerHTML = `<div class="modal-loading">${t.modalAnalyzing}</div>`;
  elements.modalContent.style.display = "";
  elements.modalAnalyzePrompt.style.display = "none";
  const response = await analyzeVocabRpc(word);
  elements.modalAnalyzeBtn.disabled = false;
  elements.modalAnalyzeBtn.textContent = t.modalAnalyze;
  if (response === undefined || response.error !== undefined) {
    elements.modalContent.innerHTML = `<div class="feedback-error">${escapeHtml(response?.error ?? "Unknown error")}</div>`;
    elements.modalAnalyzePrompt.style.display = "";
    elements.modalReanalyzeBtn.style.display = "";
    return;
  }
  renderAnalysis(response);
  const resp = await updateVocab(word, { analysis: response, frequency: response.frequency });
  if (resp !== undefined) {
    setVocabItems(resp);
    renderVocabList();
  }
}

async function handleVocabAddSubmit(): Promise<void> {
  const en = elements.vocabAddEn.value.trim();
  if (en === "") {
    return;
  }
  await addVocab(en, "");
  elements.vocabAddEn.value = "";
  elements.vocabAddForm.style.display = "none";
}

export function initVocab(): void {
  setVocabOpenHandler(openVocabModal);
  elements.reviewMinus.addEventListener("click", () => {
    void updateReviewCount(-1);
  });
  elements.reviewPlus.addEventListener("click", () => {
    void updateReviewCount(1);
  });
  elements.modalClose.addEventListener("click", closeVocabModal);
  elements.vocabModal.addEventListener("click", (e) => {
    if (e.target === elements.vocabModal) {
      closeVocabModal();
    }
  });
  elements.modalAnalyzeBtn.addEventListener("click", () => {
    void runAnalysis();
  });
  elements.modalReanalyzeBtn.addEventListener("click", () => {
    void runAnalysis();
  });
  elements.vocabSearch.addEventListener("input", () => {
    renderVocabList();
  });
  elements.vocabAddBtn.addEventListener("click", () => {
    const form = elements.vocabAddForm;
    form.style.display = form.style.display === "none" ? "" : "none";
    if (form.style.display !== "none") {
      elements.vocabAddEn.focus();
    }
  });
  elements.vocabAddSubmit.addEventListener("click", () => {
    void handleVocabAddSubmit();
  });
  void loadVocab();
}

async function handleMyExAddSubmit(): Promise<void> {
  const q = elements.myExAddQuestion.value.trim();
  if (q === "") {
    return;
  }
  const answers = [
    elements.myExAddAnswer1.value.trim(),
    elements.myExAddAnswer2.value.trim(),
    elements.myExAddAnswer3.value.trim(),
  ].filter((a) => a !== "");
  if (answers.length === 0) {
    return;
  }
  await addMyExample(q, answers);
  elements.myExAddQuestion.value = "";
  elements.myExAddAnswer1.value = "";
  elements.myExAddAnswer2.value = "";
  elements.myExAddAnswer3.value = "";
  elements.myExamplesAddForm.style.display = "none";
}

export function initMyExamples(): void {
  elements.myExamplesAddBtn.addEventListener("click", () => {
    const form = elements.myExamplesAddForm;
    form.style.display = form.style.display === "none" ? "" : "none";
    if (form.style.display !== "none") {
      elements.myExAddQuestion.focus();
    }
  });
  elements.myExAddSubmit.addEventListener("click", () => {
    void handleMyExAddSubmit();
  });
  void loadMyExamples();
}
