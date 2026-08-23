import { browser } from "wxt/browser";
import { elements } from "./el";
import { getTranslations } from "./translations";
import { switchTab } from "./ui";
import {
  generateQuiz,
  getCurrentOutputMode,
  getCurrentOutputOrigin,
  getCurrentOutputType,
  resetOutputTimer,
  setOutputMode,
  setOutputType,
} from "./output";
import { clearCache, refreshCacheStats, updateDirtyState } from "./config";
import { renderFeedback } from "./feedback";
import { renderVocabSuggestions } from "./modal";
import { loadVocab, setLastMatchedVocab } from "./vocab";
import { feedback, normaDone, tts } from "./rpc";

function showFeedbackStatus(className: string, message: string): void {
  const status = document.createElement("div");
  status.className = className;
  status.textContent = message;
  elements.outputFeedback.replaceChildren(status);
}

export async function addCurrentSiteTo(textarea: HTMLTextAreaElement): Promise<void> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.url === undefined) {
    return;
  }
  const url = new URL(tab.url);
  const pattern = `${url.origin}/*`;
  const current = textarea.value.trim();
  const lines =
    current === ""
      ? []
      : current
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l !== "");
  if (lines.includes(pattern)) {
    return;
  }
  lines.push(pattern);
  textarea.value = lines.join("\n");
  textarea.scrollTop = textarea.scrollHeight;
  updateDirtyState();
}

async function handleOutputSend(): Promise<void> {
  const userText = elements.outputTextarea.value.trim();
  if (userText === "") {
    return;
  }
  const sourceText =
    getCurrentOutputType() === "free" || getCurrentOutputType() === "quiz"
      ? ""
      : elements.outputSourceText.textContent;
  const t = getTranslations();
  elements.outputSend.disabled = true;
  elements.outputSend.textContent = t.outputSending;
  elements.outputFeedbackSection.style.display = "";
  showFeedbackStatus("feedback-loading", t.outputSending);

  const quizContext = getCurrentOutputType() === "quiz" ? elements.quizPrompt.textContent : "";
  const response = await feedback({
    mode: getCurrentOutputType() === "quiz" ? "quiz" : getCurrentOutputMode(),
    sourceText: sourceText ?? quizContext,
    userText,
  });

  elements.outputSend.disabled = false;
  elements.outputSend.textContent = t.outputSend;

  if (response === undefined || response.error !== undefined) {
    showFeedbackStatus("feedback-error", response?.error ?? "Unknown error");
    return;
  }
  renderFeedback(response);
  setLastMatchedVocab(response.matchedVocab ?? []);
  renderVocabSuggestions(response.vocabSuggestions ?? []);
  await loadVocab();
  if (sourceText !== null && sourceText !== "" && getCurrentOutputOrigin() !== "") {
    const textKey = `${getCurrentOutputOrigin()}::${sourceText}`;
    void normaDone(textKey);
  }
}

export function initTtsPreview(): void {
  let ttsPreviewAudio: HTMLAudioElement | null = null;
  elements.ttsPreviewBtn.addEventListener("click", () => {
    void (async (): Promise<void> => {
      if (ttsPreviewAudio !== null) {
        ttsPreviewAudio.pause();
        ttsPreviewAudio = null;
      }
      const t = getTranslations();
      elements.ttsPreviewBtn.disabled = true;
      elements.ttsPreviewLabel.textContent = t.ttsPreviewLoading;
      const voice = elements.ttsVoice.value === "" ? "nova" : elements.ttsVoice.value;
      const res = await tts("Hello! This is how I sound. Nice to meet you.", voice);
      elements.ttsPreviewBtn.disabled = false;
      elements.ttsPreviewLabel.textContent = t.ttsPreview;
      if (res !== undefined && res.error === undefined && res.dataUrl !== undefined) {
        ttsPreviewAudio = new Audio(res.dataUrl);
        void ttsPreviewAudio.play();
      }
    })();
  });
}

export function initOutputTab(): void {
  initTtsPreview();
  elements.tabSettings.addEventListener("click", () => {
    switchTab("settings");
    void refreshCacheStats();
  });
  elements.clearCache.addEventListener("click", () => {
    void clearCache();
  });
  elements.tabOutput.addEventListener("click", () => {
    switchTab("output");
  });
  elements.tabExplanation.addEventListener("click", () => {
    switchTab("explanation");
  });
  elements.outputTypeParagraph.addEventListener("click", () => {
    setOutputType("paragraph");
  });
  elements.outputTypeFree.addEventListener("click", () => {
    setOutputType("free");
  });
  elements.outputTypeQuiz.addEventListener("click", () => {
    setOutputType("quiz");
  });
  elements.quizNextBtn.addEventListener("click", () => {
    void generateQuiz();
  });
  elements.outputTimerReset.addEventListener("click", resetOutputTimer);
  elements.outputModeOpinion.addEventListener("change", () => {
    setOutputMode("opinion");
  });
  elements.outputModeRephrase.addEventListener("change", () => {
    setOutputMode("rephrase");
  });
  elements.outputSend.addEventListener("click", () => {
    void handleOutputSend();
  });
}
