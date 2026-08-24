import { browser } from "wxt/browser";
import { UI_LANGUAGE_KEY } from "@/utils/keys";
import { elements } from "./el";
import { populateModelSelects } from "./model";
import { updateRatioLabel, setDefaultSaveLabel } from "./config";
import { getTranslations, setCurrentLanguage, getCurrentLanguage } from "./translations";
import { getCurrentOutputMode } from "./output";

export async function loadLanguage(): Promise<"ja" | "en"> {
  const result = await browser.storage.local.get(UI_LANGUAGE_KEY);
  return result[UI_LANGUAGE_KEY] === "en" ? "en" : "ja";
}

export async function setLanguage(lang: "ja" | "en"): Promise<void> {
  setCurrentLanguage(lang);
  await browser.storage.local.set({ [UI_LANGUAGE_KEY]: lang });
  applyLanguage();
}

function applyHeaderLabels(): void {
  const t = getTranslations();
  document.title = t.title;
  elements.panelTitle.textContent = t.title;
  elements.enableTitle.textContent = t.enable;
  elements.enableDesc.textContent = t.enableDesc;
  elements.mixLanguageTitle.textContent = t.mixLanguage;
  elements.mixLanguageDesc.textContent = t.mixLanguageDesc;
  elements.translateButtonsTitle.textContent = t.translateButtons;
  elements.translateButtonsDesc.textContent = t.translateButtonsDesc;
  elements.outputSettingsLabel.textContent = t.outputSettingsLabel;
  elements.cacheLabel.textContent = t.cacheLabel;
  elements.cacheHint.textContent = t.cacheHint;
  elements.clearCache.textContent = t.cacheClear;
  elements.ttsVoiceLabel.textContent = t.ttsVoice;
  elements.ttsPreviewLabel.textContent = t.ttsPreview;
  elements.minTextLengthLabel.textContent = t.minTextLength;
  elements.minTextLengthHint.textContent = t.minTextLengthHint;
  elements.includeListLabel.textContent = t.includeList;
  elements.includeListHint.textContent = t.includeListHint;
  elements.excludeListLabel.textContent = t.excludeList;
  elements.addCurrentSiteInclude.textContent = t.addCurrentSite;
  elements.addCurrentSiteExclude.textContent = t.addCurrentSite;
  elements.modelsLabel.textContent = t.models;
  elements.modelsHint.textContent = t.modelsHint;
  elements.ratioTitle.textContent = t.ratio;
  elements.ratioEnLabel.textContent = t.english;
  elements.ratioJaLabel.textContent = t.japanese;
}

function applyTabLabels(): void {
  const t = getTranslations();
  elements.langJa.classList.toggle("is-active", getCurrentLanguage() === "ja");
  elements.langEn.classList.toggle("is-active", getCurrentLanguage() === "en");
  elements.tabSettings.textContent = t.tabSettings;
  elements.tabOutput.textContent = t.tabOutput;
  elements.tabExplanation.textContent = t.tabExplanation;
  elements.explanationSourceLabel.textContent = t.explanationSourceLabel;
  elements.explanationEmptyTitle.textContent = t.explanationEmptyTitle;
  elements.explanationEmptyDesc.textContent = t.explanationEmptyDesc;
  elements.outputRatioTitle.textContent = t.outputRatioTitle;
  elements.outputRatioValueLabel.textContent = t.outputRatioValueLabel;
  elements.outputTypeParagraphLabel.textContent = t.outputTypeParagraph;
  elements.outputTypeFreeLabel.textContent = t.outputTypeFree;
  elements.outputTypeQuizLabel.textContent = t.outputTypeQuiz;
  elements.outputEmptyTitle.textContent = t.outputEmptyTitle;
  elements.outputEmptyDesc.textContent = t.outputEmptyDesc;
  elements.outputSourceLabel.textContent = t.outputSourceLabel;
  elements.outputModeLabel.textContent = t.outputModeLabel;
  elements.outputModeOpinionLabel.textContent = t.outputModeOpinion;
  elements.outputModeRephraseLabel.textContent = t.outputModeRephrase;
  elements.outputInputLabel.textContent = t.outputInputLabel;
  elements.outputSend.textContent = t.outputSend;
  elements.outputFeedbackLabel.textContent = t.outputFeedbackLabel;
  elements.vocabSuggestLabel.textContent = t.vocabSuggestLabel;
  elements.vocabTrackerTitle.textContent = t.vocabTrackerTitle;
  elements.vocabAddSubmit.textContent = t.vocabAdd;
}

function applyOutputPlaceholder(): void {
  const t = getTranslations();
  elements.outputTextarea.placeholder =
    getCurrentOutputMode() === "opinion"
      ? t.outputTextareaPlaceholderOpinion
      : t.outputTextareaPlaceholderRephrase;
}

export function applyLanguage(): void {
  applyHeaderLabels();
  applyTabLabels();
  applyOutputPlaceholder();
  setDefaultSaveLabel(getTranslations().save);
  elements.save.textContent = getTranslations().save;
  populateModelSelects();
  updateRatioLabel();
}
