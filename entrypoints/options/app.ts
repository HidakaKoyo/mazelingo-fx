import { browser } from "wxt/browser";
import { mergeConfig, type Config } from "@/utils/config";
import { STORAGE_KEY, UI_LANGUAGE_KEY } from "@/utils/keys";
import { collectApiKeys, renderApiKeyFields } from "./api-keys";
import { elements } from "./elements";
import {
  getModelControls,
  getSelectedModels,
  populateModelSelects,
  setModelValues,
  syncCustomModelControl,
} from "./models-control";
import { CUSTOM_MODEL_VALUE } from "./models";
import {
  getCurrentLang,
  getCurrentPageMode,
  getDefaultSaveLabel,
  getSavedState,
  getShakeIntervalId,
  getShakeTimeoutId,
  SAVE_ANIMATION_DURATION_MS,
  SAVE_ANIMATION_INTERVAL_MS,
  setCurrentLang,
  setCurrentPageMode,
  setDefaultSaveLabel,
  setSavedState,
  setShakeIntervalId,
  setShakeTimeoutId,
} from "./state";
import type { SavedConfig } from "./state";
import { getTranslations } from "./translations";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isConfigLike(value: unknown): value is Config {
  return typeof value === "object" && value !== null;
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortObject(item));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .toSorted()
        .map((key) => [key, sortObject(value[key])]),
    );
  }
  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortObject(value));
}

async function loadLanguage(): Promise<"ja" | "en"> {
  const result = await browser.storage.local.get(UI_LANGUAGE_KEY);
  const lang = result[UI_LANGUAGE_KEY];
  if (lang === "en" || lang === "ja") {
    return lang;
  }
  return "ja";
}

async function setLanguage(lang: "ja" | "en"): Promise<void> {
  setCurrentLang(lang);
  await browser.storage.local.set({ [UI_LANGUAGE_KEY]: lang });
  applyLanguage();
}

function applyLanguage(): void {
  const t = getTranslations(getCurrentLang());
  document.title = t.title;
  elements.panelTitle.textContent = t.title;
  elements.panelSubtitle.textContent = t.subtitle;
  elements.enableTitle.textContent = t.enable;
  elements.enableDesc.textContent = t.enableDesc;
  elements.mixLanguageTitle.textContent = t.mixLanguage;
  elements.mixLanguageDesc.textContent = t.mixLanguageDesc;
  elements.translateButtonsTitle.textContent = t.translateButtons;
  elements.translateButtonsDesc.textContent = t.translateButtonsDesc;
  elements.minTextLengthLabel.textContent = t.minTextLength;
  elements.minTextLengthHint.textContent = t.minTextLengthHint;
  elements.pageModeOptInTitle.textContent = t.optIn;
  elements.pageModeOptInDesc.textContent = t.optInDesc;
  elements.pageModeOptOutTitle.textContent = t.optOut;
  elements.pageModeOptOutDesc.textContent = t.optOutDesc;
  elements.pageListLabel.textContent = t.pageList;
  elements.pageListOptIn.placeholder = t.pageListPlaceholder;
  elements.pageListOptOut.placeholder = t.pageListPlaceholder;
  elements.modelsLabel.textContent = t.models;
  elements.modelsHint.textContent = t.modelsHint;
  elements.ratioTitle.textContent = t.ratio;
  elements.ratioEnLabel.textContent = t.english;
  elements.ratioJaLabel.textContent = t.japanese;
  elements.langJa.classList.toggle("is-active", getCurrentLang() === "ja");
  elements.langEn.classList.toggle("is-active", getCurrentLang() === "en");
  elements.save.textContent = t.save;
  setDefaultSaveLabel(t.save);
  populateModelSelects();
  updateRatioLabel();
}

// Map the opt-in / opt-out UI onto the content script's actual config contract:
// `pageListInclude` / `pageListExclude` (newline-separated glob patterns).
function collectPageList(): { pageListInclude: string; pageListExclude: string } {
  if (getCurrentPageMode() === "optIn") {
    return { pageListExclude: "", pageListInclude: elements.pageListOptIn.value };
  }
  return { pageListExclude: elements.pageListOptOut.value, pageListInclude: "https://*" };
}

function collectFormState(): Config {
  const pageList = collectPageList();
  return {
    apiKeys: collectApiKeys(),
    enabled: elements.enabled.checked,
    englishRatio: Number(elements.englishRatio.value || 0),
    minTextLength: Number(elements.minTextLength.value || 2),
    mixLanguage: elements.mixLanguage.checked,
    models: getSelectedModels(),
    outputRatio: 20,
    pageListExclude: pageList.pageListExclude,
    pageListInclude: pageList.pageListInclude,
    translateButtons: elements.translateButtons.checked,
    ttsVoice: "nova",
    uiLanguage: getCurrentLang(),
  };
}

function hasUnsavedChanges(): boolean {
  if (getSavedState() === null) {
    return false;
  }
  return stableStringify(collectFormState()) !== stableStringify(getSavedState());
}

function triggerSaveAnimation(): void {
  elements.save.classList.add("is-shaking");
  const timeoutId = getShakeTimeoutId();
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  setShakeTimeoutId(
    setTimeout(() => {
      elements.save.classList.remove("is-shaking");
    }, SAVE_ANIMATION_DURATION_MS),
  );
}

function setSaveAnimation(active: boolean): void {
  if (active) {
    if (getShakeIntervalId()) {
      return;
    }
    triggerSaveAnimation();
    setShakeIntervalId(setInterval(triggerSaveAnimation, SAVE_ANIMATION_INTERVAL_MS));
    return;
  }
  const intervalId = getShakeIntervalId();
  if (intervalId) {
    clearInterval(intervalId);
    setShakeIntervalId(null);
  }
  const timeoutId = getShakeTimeoutId();
  if (timeoutId) {
    clearTimeout(timeoutId);
    setShakeTimeoutId(null);
  }
  elements.save.classList.remove("is-shaking");
}

function updateDirtyState(): void {
  if (getSavedState() === null) {
    return;
  }
  setSaveAnimation(hasUnsavedChanges());
}

function setPageMode(mode: "optIn" | "optOut"): void {
  const nextMode = mode === "optIn" ? "optIn" : "optOut";
  setCurrentPageMode(nextMode);
  const isOptIn = nextMode === "optIn";
  elements.pageModeOptIn.classList.toggle("is-active", isOptIn);
  elements.pageModeOptOut.classList.toggle("is-active", !isOptIn);
  elements.pageModeOptIn.setAttribute("aria-pressed", isOptIn ? "true" : "false");
  elements.pageModeOptOut.setAttribute("aria-pressed", isOptIn ? "false" : "true");
  elements.pageListOptIn.style.display = isOptIn ? "" : "none";
  elements.pageListOptOut.style.display = isOptIn ? "none" : "";
  updateDirtyState();
}

function updateRatioLabel(): void {
  const t = getTranslations(getCurrentLang()),
    value = Number(elements.englishRatio.value || 0);
  if (elements.ratioLabel !== null) {
    elements.ratioLabel.textContent = `${t.english}${value}% / ${t.japanese}${100 - value}%`;
  }
  elements.ratioFill.style.width = `${value}%`;
  elements.ratioEnValue.textContent = `${value}%`;
  elements.ratioJaValue.textContent = `${100 - value}%`;
  updateDirtyState();
}

async function loadConfig(): Promise<Config> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY];
  return mergeConfig(isConfigLike(stored) ? stored : undefined);
}

async function saveConfig(): Promise<void> {
  const config = collectFormState();
  await browser.storage.local.set({ [STORAGE_KEY]: config });
  setSavedState(collectFormState());
  const t = getTranslations(getCurrentLang());
  elements.save.textContent = t.saved;
  setTimeout(() => {
    elements.save.textContent = getDefaultSaveLabel();
  }, 1500);
}

function handleModelChange(): void {
  renderApiKeyFields(getSelectedModels(), collectApiKeys(), updateDirtyState);
  updateDirtyState();
}

function applyInitialUi(config: Readonly<SavedConfig>): void {
  elements.enabled.checked = config.enabled;
  elements.mixLanguage.checked = config.mixLanguage;
  elements.translateButtons.checked = config.translateButtons;
  elements.minTextLength.value = String(config.minTextLength);
  // Options page edits the page list via an opt-in/opt-out UI that maps onto
  // PageListInclude / pageListExclude. Preserve both lists on load.
  elements.pageListOptIn.value = config.pageListInclude ?? "";
  elements.pageListOptOut.value = config.pageListExclude ?? "";
  setPageMode(config.pageListExclude === "" ? "optIn" : "optOut");
  elements.englishRatio.value = String(config.englishRatio);
  applyLanguage();
  setModelValues(config.models);
  renderApiKeyFields(config.models, config.apiKeys, updateDirtyState);
  setSavedState(collectFormState());
}

function registerModelListeners(): void {
  for (const control of getModelControls()) {
    control.select.addEventListener("change", () => {
      syncCustomModelControl(control);
      if (control.select.value === CUSTOM_MODEL_VALUE) {
        control.input.focus();
      }
      handleModelChange();
    });
    control.input.addEventListener("input", handleModelChange);
  }
}

function registerListeners(): void {
  registerModelListeners();
  elements.enabled.addEventListener("change", updateDirtyState);
  elements.mixLanguage.addEventListener("change", updateDirtyState);
  elements.translateButtons.addEventListener("change", updateDirtyState);
  elements.minTextLength.addEventListener("input", updateDirtyState);
  elements.englishRatio.addEventListener("input", updateRatioLabel);
  elements.pageListOptIn.addEventListener("input", updateDirtyState);
  elements.pageListOptOut.addEventListener("input", updateDirtyState);
  elements.pageModeOptIn.addEventListener("click", () => {
    setPageMode("optIn");
  });
  elements.pageModeOptOut.addEventListener("click", () => {
    setPageMode("optOut");
  });
  elements.save.addEventListener("click", () => {
    void saveConfig();
  });
  elements.langJa.addEventListener("click", () => {
    void setLanguage("ja");
  });
  elements.langEn.addEventListener("click", () => {
    void setLanguage("en");
  });
}

export async function initApp(): Promise<void> {
  const [config, lang] = await Promise.all([loadConfig(), loadLanguage()]);
  setCurrentLang(lang);
  applyInitialUi(config);
  registerListeners();
}
