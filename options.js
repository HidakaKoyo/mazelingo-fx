import { mergeConfig } from "./config.js";
import { LLM_REGISTRY } from "./llm.js";

const STORAGE_KEY = "mlg_config";
const UI_LANGUAGE_KEY = "mlg_ui_language";
const CUSTOM_MODEL_VALUE = "__custom__";

const MODEL_OPTIONS = [
  { value: "", label: { ja: "（なし）", en: "(none)" } },
  // GLM
  "glm-4.5", "glm-4.5-air", "glm-4.6", "glm-4.7", "glm-5", "glm-5-turbo",
  // GPT
  "gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano",
  "gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-5.1", "gpt-5.2",
  "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano",
  "o1", "o3", "o3-mini", "o4-mini",
  // Claude
  "claude-sonnet-4-6", "claude-sonnet-4-5-20250929", "claude-sonnet-4-20250514",
  "claude-opus-4-6", "claude-opus-4-5-20251101", "claude-opus-4-1-20250805",
  "claude-opus-4-20250514", "claude-haiku-4-5-20251001", "claude-3-haiku-20240307",
  // Gemini
  "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro", "gemini-3-flash-preview",
  "gemini-3.1-flash-lite", "gemini-3.1-pro-preview", "gemini-3.5-flash-lite",
  "gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.7-flash",
  // OpenRouter
  "openrouter/openai/gpt-4.1-mini", "openrouter/google/gemini-2.5-flash",
  "openrouter/deepseek/deepseek-chat", "openrouter/anthropic/claude-haiku-4.5",
  { value: CUSTOM_MODEL_VALUE, label: { ja: "カスタム…", en: "Custom…" } },
];
const SAVE_ANIMATION_DURATION_MS = 700;
const SAVE_ANIMATION_INTERVAL_MS = 1500;
const translations = {
  ja: {
    title: "Mazelingo 設定",
    subtitle: "Duolingo風の丸みデザイン",
    enable: "翻訳を有効にする",
    enableDesc: "自動翻訳機能をオンにします",
    mixLanguage: "言語をミックス",
    mixLanguageDesc: "文ごとにランダムに言語を混ぜる",
    optIn: "オプトイン",
    optOut: "オプトアウト",
    optInDesc: "指定したページのみ翻訳",
    optOutDesc: "指定したページを除外",
    pageList: "ページリスト",
    pageListPlaceholder: "URLを1行ずつ入力\n例: https://example.com/*",
    models: "モデルチェーン",
    modelsHint: "優先順にフォールバック（空欄はスキップ）",
    customModelPlaceholder: "モデルIDを入力（例: openrouter/meta-llama/llama-3.3-70b-instruct）",
    ratio: "言語の割合",
    english: "英語",
    japanese: "日本語",
    translateButtons: "ボタンを翻訳",
    translateButtonsDesc: "ボタン内のテキストも翻訳する",
    minTextLength: "最小文字数",
    minTextLengthHint: "この文字数未満のテキストは翻訳しない",
    save: "保存",
    saved: "保存しました！",
  },
  en: {
    title: "Mazelingo Settings",
    subtitle: "Duolingo-inspired rounded layout",
    enable: "Enable translation",
    enableDesc: "Turn on automatic translation",
    mixLanguage: "Mix languages",
    mixLanguageDesc: "Randomly mix languages per sentence",
    optIn: "Opt-in",
    optOut: "Opt-out",
    optInDesc: "Only translate specified pages",
    optOutDesc: "Exclude specified pages",
    pageList: "Page list",
    pageListPlaceholder: "Enter URLs, one per line\ne.g. https://example.com/*",
    models: "Model chain",
    modelsHint: "Fallback in priority order (empty = skip)",
    customModelPlaceholder: "Enter a model ID (e.g. openrouter/meta-llama/llama-3.3-70b-instruct)",
    ratio: "Language ratio",
    english: "English",
    japanese: "Japanese",
    translateButtons: "Translate buttons",
    translateButtonsDesc: "Also translate text inside buttons",
    minTextLength: "Min text length",
    minTextLengthHint: "Text shorter than this will not be translated",
    save: "Save",
    saved: "Saved!",
  },
};

const elements = {
  enabled: document.getElementById("enabled"),
  mixLanguage: document.getElementById("mixLanguage"),
  model0: document.getElementById("model0"),
  model1: document.getElementById("model1"),
  model2: document.getElementById("model2"),
  customModel0: document.getElementById("customModel0"),
  customModel1: document.getElementById("customModel1"),
  customModel2: document.getElementById("customModel2"),
  apiKeysSection: document.getElementById("apiKeysSection"),
  englishRatio: document.getElementById("englishRatio"),
  ratioLabel: document.getElementById("ratioLabel"),
  ratioFill: document.getElementById("ratioFill"),
  ratioEnValue: document.getElementById("ratioEnValue"),
  ratioJaValue: document.getElementById("ratioJaValue"),
  save: document.getElementById("save"),
  status: document.getElementById("status"),
  panelTitle: document.getElementById("panelTitle"),
  panelSubtitle: document.getElementById("panelSubtitle"),
  enableTitle: document.getElementById("enableTitle"),
  enableDesc: document.getElementById("enableDesc"),
  mixLanguageTitle: document.getElementById("mixLanguageTitle"),
  mixLanguageDesc: document.getElementById("mixLanguageDesc"),
  translateButtons: document.getElementById("translateButtons"),
  translateButtonsTitle: document.getElementById("translateButtonsTitle"),
  translateButtonsDesc: document.getElementById("translateButtonsDesc"),
  minTextLength: document.getElementById("minTextLength"),
  minTextLengthLabel: document.getElementById("minTextLengthLabel"),
  minTextLengthHint: document.getElementById("minTextLengthHint"),
  pageModeOptIn: document.getElementById("pageModeOptIn"),
  pageModeOptOut: document.getElementById("pageModeOptOut"),
  pageModeOptInTitle: document.getElementById("pageModeOptInTitle"),
  pageModeOptInDesc: document.getElementById("pageModeOptInDesc"),
  pageModeOptOutTitle: document.getElementById("pageModeOptOutTitle"),
  pageModeOptOutDesc: document.getElementById("pageModeOptOutDesc"),
  pageListLabel: document.getElementById("pageListLabel"),
  pageListOptIn: document.getElementById("pageListOptIn"),
  pageListOptOut: document.getElementById("pageListOptOut"),
  modelsLabel: document.getElementById("modelsLabel"),
  modelsHint: document.getElementById("modelsHint"),
  ratioTitle: document.getElementById("ratioTitle"),
  ratioEnLabel: document.getElementById("ratioEnLabel"),
  ratioJaLabel: document.getElementById("ratioJaLabel"),
  langJa: document.getElementById("langJa"),
  langEn: document.getElementById("langEn"),
};
let defaultSaveLabel = elements.save.textContent;
let currentLang = "ja";
let currentPageMode = "optOut";
let savedState = null;
let shakeIntervalId = null;
let shakeTimeoutId = null;

function getTranslations() {
  return translations[currentLang] || translations.ja;
}

async function loadLanguage() {
  const result = await chrome.storage.local.get(UI_LANGUAGE_KEY);
  return result[UI_LANGUAGE_KEY] || "ja";
}

async function setLanguage(lang) {
  currentLang = lang;
  await chrome.storage.local.set({ [UI_LANGUAGE_KEY]: lang });
  applyLanguage();
}

function applyLanguage() {
  const t = getTranslations();
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
  elements.langJa.classList.toggle("is-active", currentLang === "ja");
  elements.langEn.classList.toggle("is-active", currentLang === "en");
  elements.save.textContent = t.save;
  defaultSaveLabel = t.save;
  populateModelSelects();
  updateRatioLabel();
}

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortObject(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(sortObject(value));
}

function getProviderPrefix(modelName) {
  const prefixes = Object.keys(LLM_REGISTRY).sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (modelName.startsWith(prefix)) return prefix;
  }
  return null;
}

function getModelSelects() {
  return [elements.model0, elements.model1, elements.model2];
}

function getModelControls() {
  return [
    { select: elements.model0, input: elements.customModel0 },
    { select: elements.model1, input: elements.customModel1 },
    { select: elements.model2, input: elements.customModel2 },
  ];
}

function getModelValue({ select, input }) {
  return select.value === CUSTOM_MODEL_VALUE ? input.value.trim() : select.value;
}

function getSelectedModels() {
  return getModelControls().map(getModelValue).filter(Boolean);
}

function isListedModel(modelName) {
  return MODEL_OPTIONS.some(opt => (
    typeof opt === "string" ? opt === modelName : opt.value === modelName
  ));
}

function syncCustomModelControl(control) {
  const isCustom = control.select.value === CUSTOM_MODEL_VALUE;
  control.input.hidden = !isCustom;
  control.input.placeholder = getTranslations().customModelPlaceholder;
}

function setModelControlValue(control, modelName) {
  if (!modelName || isListedModel(modelName)) {
    control.select.value = modelName || "";
    control.input.value = "";
  } else {
    control.select.value = CUSTOM_MODEL_VALUE;
    control.input.value = modelName;
  }
  syncCustomModelControl(control);
}

function setModelValues(models) {
  getModelControls().forEach((control, index) => {
    setModelControlValue(control, models[index] || "");
  });
}

function populateModelSelects() {
  const t = getTranslations();
  for (const control of getModelControls()) {
    const { select: sel } = control;
    const current = getModelValue(control);
    sel.innerHTML = "";
    for (const opt of MODEL_OPTIONS) {
      const o = document.createElement("option");
      if (typeof opt === "string") {
        o.value = opt;
        o.textContent = opt;
      } else {
        o.value = opt.value;
        o.textContent = typeof opt.label === "object" ? (opt.label[currentLang] || opt.label.ja) : opt.label;
      }
      sel.appendChild(o);
    }
    setModelControlValue(control, current);
  }
}

function renderApiKeyFields(models, apiKeys) {
  elements.apiKeysSection.innerHTML = "";
  const seen = new Set();
  const prefixes = [];
  models.forEach((model) => {
    const prefix = getProviderPrefix(model);
    const apiKeyKey = prefix && (LLM_REGISTRY[prefix].apiKeyKey || prefix);
    if (apiKeyKey && !seen.has(apiKeyKey)) {
      seen.add(apiKeyKey);
      prefixes.push(apiKeyKey);
    }
  });
  prefixes.forEach((prefix) => {
    const row = document.createElement("div");
    row.className = "api-key-row";

    const label = document.createElement("label");
    label.textContent = `${prefix} API key`;
    label.setAttribute("for", `apikey-${prefix}`);

    const wrap = document.createElement("div");
    wrap.className = "api-key-wrap";

    const input = document.createElement("input");
    input.type = "password";
    input.id = `apikey-${prefix}`;
    input.className = "input";
    input.dataset.prefix = prefix;
    input.placeholder = `${prefix} API key`;
    input.value = apiKeys[prefix] || "";
    input.addEventListener("input", updateDirtyState);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "api-key-toggle";
    toggle.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    toggle.addEventListener("click", () => {
      if (input.type === "password") {
        input.type = "text";
      } else {
        input.type = "password";
      }
    });

    wrap.appendChild(input);
    wrap.appendChild(toggle);
    row.appendChild(label);
    row.appendChild(wrap);
    elements.apiKeysSection.appendChild(row);
  });
}

function collectApiKeys() {
  const keys = {};
  const inputs = elements.apiKeysSection.querySelectorAll("input[data-prefix]");
  inputs.forEach((input) => {
    const value = input.value.trim();
    if (value) {
      keys[input.dataset.prefix] = value;
    }
  });
  return keys;
}

function collectFormState() {
  return {
    enabled: elements.enabled.checked,
    mixLanguage: elements.mixLanguage.checked,
    translateButtons: elements.translateButtons.checked,
    minTextLength: Number(elements.minTextLength.value || 5),
    pageMode: currentPageMode,
    pageListOptIn: elements.pageListOptIn.value,
    pageListOptOut: elements.pageListOptOut.value,
    models: getSelectedModels(),
    apiKeys: collectApiKeys(),
    englishRatio: Number(elements.englishRatio.value || 0),
  };
}

function hasUnsavedChanges() {
  if (!savedState) return false;
  return stableStringify(collectFormState()) !== stableStringify(savedState);
}

function triggerSaveAnimation() {
  elements.save.classList.add("is-shaking");
  if (shakeTimeoutId) {
    clearTimeout(shakeTimeoutId);
  }
  shakeTimeoutId = setTimeout(() => {
    elements.save.classList.remove("is-shaking");
  }, SAVE_ANIMATION_DURATION_MS);
}

function setSaveAnimation(active) {
  if (active) {
    if (shakeIntervalId) return;
    triggerSaveAnimation();
    shakeIntervalId = setInterval(triggerSaveAnimation, SAVE_ANIMATION_INTERVAL_MS);
    return;
  }
  if (shakeIntervalId) {
    clearInterval(shakeIntervalId);
    shakeIntervalId = null;
  }
  if (shakeTimeoutId) {
    clearTimeout(shakeTimeoutId);
    shakeTimeoutId = null;
  }
  elements.save.classList.remove("is-shaking");
}

function updateDirtyState() {
  if (!savedState) return;
  setSaveAnimation(hasUnsavedChanges());
}

function setSavedState(state) {
  savedState = state;
  updateDirtyState();
}

function setPageMode(mode) {
  currentPageMode = mode === "optIn" ? "optIn" : "optOut";
  const isOptIn = currentPageMode === "optIn";
  elements.pageModeOptIn.classList.toggle("is-active", isOptIn);
  elements.pageModeOptOut.classList.toggle("is-active", !isOptIn);
  elements.pageModeOptIn.setAttribute("aria-pressed", isOptIn ? "true" : "false");
  elements.pageModeOptOut.setAttribute("aria-pressed", isOptIn ? "false" : "true");
  elements.pageListOptIn.style.display = isOptIn ? "" : "none";
  elements.pageListOptOut.style.display = isOptIn ? "none" : "";
  updateDirtyState();
}

function updateRatioLabel() {
  const value = Number(elements.englishRatio.value || 0);
  const t = getTranslations();
  if (elements.ratioLabel) {
    elements.ratioLabel.textContent = `${t.english}${value}% / ${t.japanese}${
      100 - value
    }%`;
  }
  if (elements.ratioFill) {
    elements.ratioFill.style.width = `${value}%`;
  }
  if (elements.ratioEnValue) {
    elements.ratioEnValue.textContent = `${value}%`;
  }
  if (elements.ratioJaValue) {
    elements.ratioJaValue.textContent = `${100 - value}%`;
  }
  updateDirtyState();
}

async function loadConfig() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return mergeConfig(result[STORAGE_KEY]);
}

async function saveConfig() {
  const config = collectFormState();
  await chrome.storage.local.set({ [STORAGE_KEY]: config });
  setSavedState(collectFormState());
  const t = getTranslations();
  elements.save.textContent = t.saved;
  setTimeout(() => {
    elements.save.textContent = defaultSaveLabel;
  }, 1500);
}

async function init() {
  const [config, lang] = await Promise.all([loadConfig(), loadLanguage()]);
  currentLang = lang;
  elements.enabled.checked = config.enabled;
  elements.mixLanguage.checked = config.mixLanguage;
  elements.translateButtons.checked = config.translateButtons;
  elements.minTextLength.value = config.minTextLength;
  elements.pageListOptIn.value = config.pageListOptIn || config.pageList || "";
  elements.pageListOptOut.value = config.pageListOptOut || config.pageList || "";
  setPageMode(config.pageMode || "optOut");
  const models = config.models || [];
  elements.englishRatio.value = config.englishRatio;
  applyLanguage();
  // Set model select values after populateModelSelects (called in applyLanguage)
  setModelValues(models);
  renderApiKeyFields(models, config.apiKeys || {});
  setSavedState(collectFormState());

  function onModelChange() {
    renderApiKeyFields(getSelectedModels(), collectApiKeys());
    updateDirtyState();
  }
  for (const control of getModelControls()) {
    control.select.addEventListener("change", () => {
      syncCustomModelControl(control);
      if (control.select.value === CUSTOM_MODEL_VALUE) control.input.focus();
      onModelChange();
    });
    control.input.addEventListener("input", onModelChange);
  }
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
  elements.save.addEventListener("click", saveConfig);
  elements.langJa.addEventListener("click", () => {
    setLanguage("ja");
  });
  elements.langEn.addEventListener("click", () => {
    setLanguage("en");
  });
}

init().catch(() => {});
