import type { Config } from "@/utils/config";
import { elements } from "./el";
import type { DeepReadonly } from "./util";
import { CUSTOM_MODEL_VALUE, TTS_VOICES } from "./constants";
import { applyLanguage } from "./language";
import {
  collectFormState,
  refreshCacheStats,
  setSavedState,
  stepRange,
  updateDirtyState,
  updateOutputRatioLabel,
  updateRatioLabel,
} from "./config";
import {
  collectApiKeys,
  getModelControls,
  getSelectedModels,
  renderApiKeyFields,
  setModelValues,
  syncCustomModelControl,
} from "./model";
import { addCurrentSiteTo } from "./init-output";

function onModelChange(): void {
  renderApiKeyFields(getSelectedModels(), collectApiKeys(), updateDirtyState);
  updateDirtyState();
}

function initSettings(config: DeepReadonly<Config>): void {
  elements.enabled.checked = config.enabled;
  elements.mixLanguage.checked = config.mixLanguage;
  elements.translateButtons.checked = config.translateButtons;
  elements.ttsVoice.innerHTML = "";
  TTS_VOICES.forEach((v: Readonly<{ label: string; value: string }>) => {
    const o = document.createElement("option");
    o.value = v.value;
    o.textContent = v.label;
    elements.ttsVoice.append(o);
  });
  elements.ttsVoice.value = config.ttsVoice ?? "nova";
  elements.minTextLength.value = String(config.minTextLength);
  elements.pageListInclude.value = config.pageListInclude ?? "";
  elements.pageListExclude.value = config.pageListExclude ?? "";
  const models = config.models ?? [];
  elements.englishRatio.value = String(config.englishRatio);
  elements.outputRatio.value = String(config.outputRatio);
  applyLanguage();
  void refreshCacheStats().catch((error) => {
    console.warn(
      "[mlg:popup] cache stats failed:",
      error instanceof Error ? error.message : String(error),
    );
  });
  updateOutputRatioLabel();
  setModelValues(models);
  renderApiKeyFields(models, config.apiKeys ?? {}, updateDirtyState);
  setSavedState(collectFormState());
}

function initSettingsListeners(): void {
  for (const control of getModelControls()) {
    control.select.addEventListener("change", () => {
      syncCustomModelControl(control);
      if (control.select.value === CUSTOM_MODEL_VALUE) {
        control.input.focus();
      }
      onModelChange();
    });
    control.input.addEventListener("input", onModelChange);
  }
  elements.enabled.addEventListener("change", updateDirtyState);
  elements.mixLanguage.addEventListener("change", updateDirtyState);
  elements.translateButtons.addEventListener("change", updateDirtyState);
  elements.ttsVoice.addEventListener("change", updateDirtyState);
  elements.minTextLength.addEventListener("input", updateDirtyState);
  elements.englishRatio.addEventListener("input", updateRatioLabel);
  elements.englishRatioMinus.addEventListener("click", () => {
    stepRange(elements.englishRatio, -1, updateRatioLabel);
  });
  elements.englishRatioPlus.addEventListener("click", () => {
    stepRange(elements.englishRatio, 1, updateRatioLabel);
  });
  elements.pageListInclude.addEventListener("input", updateDirtyState);
  elements.pageListExclude.addEventListener("input", updateDirtyState);
  elements.addCurrentSiteInclude.addEventListener("click", () => {
    void addCurrentSiteTo(elements.pageListInclude);
  });
  elements.addCurrentSiteExclude.addEventListener("click", () => {
    void addCurrentSiteTo(elements.pageListExclude);
  });
  elements.outputRatio.addEventListener("input", updateOutputRatioLabel);
  elements.outputRatioMinus.addEventListener("click", () => {
    stepRange(elements.outputRatio, -1, updateOutputRatioLabel);
  });
  elements.outputRatioPlus.addEventListener("click", () => {
    stepRange(elements.outputRatio, 1, updateOutputRatioLabel);
  });
}

export function initSettingsModule(config: DeepReadonly<Config>): void {
  initSettings(config);
  initSettingsListeners();
}
