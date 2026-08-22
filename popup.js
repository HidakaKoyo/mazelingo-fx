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
const TTS_VOICES = [
  { value: "alloy", label: "Alloy" },
  { value: "ash", label: "Ash" },
  { value: "coral", label: "Coral" },
  { value: "echo", label: "Echo" },
  { value: "fable", label: "Fable" },
  { value: "nova", label: "Nova" },
  { value: "onyx", label: "Onyx" },
  { value: "sage", label: "Sage" },
  { value: "shimmer", label: "Shimmer" },
];
const SAVE_ANIMATION_DURATION_MS = 700;
const SAVE_ANIMATION_INTERVAL_MS = 1500;
const translations = {
  ja: {
    title: "Mazelingo 設定",
    enable: "翻訳を有効にする",
    enableDesc: "自動翻訳機能をオンにします",
    mixLanguage: "言語をミックス",
    mixLanguageDesc: "文ごとにランダムに言語を混ぜる",
    includeList: "翻訳するページ",
    includeListHint: "https://* で全サイトにマッチ",
    excludeList: "除外するページ",
    addCurrentSite: "このサイトを追加",
    models: "モデルチェーン",
    modelsHint: "優先順にフォールバック（空欄はスキップ）",
    customModelPlaceholder: "モデルIDを入力（例: openrouter/meta-llama/llama-3.3-70b-instruct）",
    ratio: "言語の割合",
    english: "英語",
    japanese: "日本語",
    translateButtons: "ボタンを翻訳",
    translateButtonsDesc: "ボタン内のテキストも翻訳する",
    ttsVoice: "音声",
    ttsPreview: "試聴",
    ttsPreviewLoading: "読込中…",
    minTextLength: "最小文字数",
    minTextLengthHint: "この文字数未満のテキストは翻訳しない",
    addCurrentSite: "このサイトを追加",
    tabSettings: "設定",
    tabOutput: "アウトプット",
    tabExplanation: "解説",
    explanationEmptyTitle: "解説",
    explanationEmptyDesc: "単語や文章の解説をここに表示します",
    explanationSourceLabel: "英文",
    explanationTranslationLabel: "日本語",
    explanationLoading: "解説を生成中…",
    explanationError: "解説を生成できませんでした",
    explanationOverview: "全体像",
    explanationChunks: "読み解き",
    explanationGrammar: "文法ポイント",
    explanationVocabulary: "語彙・ニュアンス",
    explanationSteps: "読む順番",
    outputSettingsLabel: "アウトプット設定",
    cacheLabel: "翻訳キャッシュ",
    cacheHint: "翻訳結果を7日間保存して再翻訳を省きます。溜まると動作が重くなることがあります",
    cacheStats: (n, size) => `${n}件 / ${size}`,
    cacheClear: "キャッシュを削除",
    cacheCleared: "削除しました",
    outputRatioTitle: "ノルマ割合",
    outputRatioValueLabel: "ノルマ",
    outputTypeParagraph: "本文から作文",
    outputTypeFree: "自由作文",
    outputTypeQuiz: "出題モード",
    quizLoading: "お題を生成中…",
    quizNext: "次のお題",
    outputEmptyTitle: "パラグラフを選択してください",
    outputEmptyDesc: "ページ上の鉛筆ボタンを押すと始まります",
    outputFreeEmptyTitle: "自由に英文を書いてみましょう",
    outputFreeEmptyDesc: "テーマは自由です",
    outputSourceLabel: "元のテキスト",
    outputModeLabel: "モード",
    outputModeOpinion: "感想・考察",
    outputModeRephrase: "言い換え・要約",
    outputInputLabel: "あなたの文章",
    outputTextareaPlaceholderOpinion: "この文章について英語で感想や考察を書いてみましょう…",
    outputTextareaPlaceholderRephrase: "この文章を英語で言い換え・要約してみましょう…",
    outputSend: "Send",
    outputSending: "添削中…",
    outputFeedbackLabel: "フィードバック",
    alternativeTitle: "こんな視点でも書けます",
    outputPerfect: "完璧です！修正点はありません。",
    vocabSuggestLabel: "語彙の追加候補",
    vocabTrackerTitle: "語彙トラッカー",
    vocabCount: "回",
    vocabHeaderWord: "語彙",
    vocabHeaderCount: "使用回数",
    vocabHeaderReview: "復習回数",
    vocabAdd: "追加",
    freqDesc5: "日常会話で1日に何度も使う超基本語彙",
    freqDesc4: "会話で毎日のように使う。非常に一般的",
    freqDesc3: "会話で使うが、やや場面が限られる",
    freqDesc2: "会話ではたまに。カジュアルな場面では少ない",
    freqDesc1: "会話ではまれ。フォーマル・文語的",
    vocabUnclassified: "未分類",
    vocabAutoAnalyze: "自動分析",
    vocabAutoAnalyzeStop: "停止",
    vocabReanalyzeGroup: "再分析",
    modalAnalyze: "分析",
    modalReanalyze: "再分析",
    modalAnalyzing: "分析中…",
    modalMeaning: "意味",
    modalDefinition: "意味",
    modalCoreImage: "コアイメージ",
    modalNativeFeel: "ネイティブ感覚",
    modalUsageScene: "使用シーン",
    modalFrequency: "頻出度",
    modalDifficulty: "難易度",
    modalEtymology: "語源",
    modalPronunciation: "発音",
    modalIpa: "発音記号",
    modalListen: "発音を聞く",
    modalExamples: "例文",
    modalCollocations: "コロケーション",
    modalVisual: "ビジュアル",
    modalImage: "イメージ",
    modalYoutube: "YouTube",
    modalMovie: "洋画・ドラマ",
    modalRelated: "関連語",
    modalSynonyms: "類義語",
    modalAntonyms: "反義語",
    modalDerivatives: "派生語",
    save: "保存",
    saved: "保存しました！",
  },
  en: {
    title: "Mazelingo Settings",
    enable: "Enable translation",
    enableDesc: "Turn on automatic translation",
    mixLanguage: "Mix languages",
    mixLanguageDesc: "Randomly mix languages per sentence",
    includeList: "Pages to translate",
    includeListHint: "https://* matches all sites",
    excludeList: "Pages to exclude",
    addCurrentSite: "Add this site",
    models: "Model chain",
    modelsHint: "Fallback in priority order (empty = skip)",
    customModelPlaceholder: "Enter a model ID (e.g. openrouter/meta-llama/llama-3.3-70b-instruct)",
    ratio: "Language ratio",
    english: "English",
    japanese: "Japanese",
    translateButtons: "Translate buttons",
    translateButtonsDesc: "Also translate text inside buttons",
    ttsVoice: "Voice",
    ttsPreview: "Preview",
    ttsPreviewLoading: "Loading…",
    minTextLength: "Min text length",
    minTextLengthHint: "Text shorter than this will not be translated",
    addCurrentSite: "Add this site",
    tabSettings: "Settings",
    tabOutput: "Output",
    tabExplanation: "Explanation",
    explanationEmptyTitle: "Explanation",
    explanationEmptyDesc: "Word and sentence explanations will appear here",
    explanationSourceLabel: "English",
    explanationTranslationLabel: "Japanese",
    explanationLoading: "Generating explanation…",
    explanationError: "Could not generate the explanation",
    explanationOverview: "Overview",
    explanationChunks: "Close reading",
    explanationGrammar: "Grammar points",
    explanationVocabulary: "Vocabulary / nuance",
    explanationSteps: "Reading order",
    outputSettingsLabel: "Output settings",
    cacheLabel: "Translation cache",
    cacheHint: "Stores translations for 7 days to skip re-translating. A large cache can slow things down",
    cacheStats: (n, size) => `${n} entries / ${size}`,
    cacheClear: "Clear cache",
    cacheCleared: "Cleared",
    outputRatioTitle: "Norma ratio",
    outputRatioValueLabel: "Norma",
    outputTypeParagraph: "From text",
    outputTypeFree: "Free writing",
    outputTypeQuiz: "Quiz mode",
    quizLoading: "Generating prompt…",
    quizNext: "Next prompt",
    outputEmptyTitle: "Select a paragraph",
    outputEmptyDesc: "Click the pencil button on the page to start",
    outputFreeEmptyTitle: "Write freely in English",
    outputFreeEmptyDesc: "Any topic you like",
    outputSourceLabel: "Original text",
    outputModeLabel: "Mode",
    outputModeOpinion: "Opinion / Analysis",
    outputModeRephrase: "Rephrase / Summarize",
    outputInputLabel: "Your writing",
    outputTextareaPlaceholderOpinion: "Write your thoughts or analysis in English…",
    outputTextareaPlaceholderRephrase: "Rephrase or summarize this text in English…",
    outputSend: "Send",
    outputSending: "Checking…",
    outputFeedbackLabel: "Feedback",
    alternativeTitle: "Other perspectives you could write from",
    outputPerfect: "Perfect! No corrections needed.",
    vocabSuggestLabel: "Vocabulary suggestions",
    vocabTrackerTitle: "Vocab tracker",
    vocabCount: "x",
    vocabHeaderWord: "Vocabulary",
    vocabHeaderCount: "Used",
    vocabHeaderReview: "Reviewed",
    vocabAdd: "Add",
    freqDesc5: "Used multiple times per day in spoken English",
    freqDesc4: "Used daily or almost daily in conversation",
    freqDesc3: "Fairly common but more situational",
    freqDesc2: "Occasionally used in conversation",
    freqDesc1: "Rarely spoken. Mostly formal or written",
    vocabUnclassified: "Unclassified",
    vocabAutoAnalyze: "Auto-analyze",
    vocabAutoAnalyzeStop: "Stop",
    vocabReanalyzeGroup: "Re-analyze",
    modalAnalyze: "Analyze",
    modalReanalyze: "Re-analyze",
    modalAnalyzing: "Analyzing…",
    modalMeaning: "Meaning",
    modalDefinition: "Definition",
    modalCoreImage: "Core image",
    modalNativeFeel: "Native feel",
    modalUsageScene: "Usage scene",
    modalFrequency: "Frequency",
    modalDifficulty: "Difficulty",
    modalEtymology: "Etymology",
    modalPronunciation: "Pronunciation",
    modalIpa: "IPA",
    modalListen: "Listen",
    modalExamples: "Examples",
    modalCollocations: "Collocations",
    modalVisual: "Visual",
    modalImage: "Image",
    modalYoutube: "YouTube",
    modalMovie: "Movie / TV",
    modalRelated: "Related words",
    modalSynonyms: "Synonyms",
    modalAntonyms: "Antonyms",
    modalDerivatives: "Derivatives",
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
  ratioFill: document.getElementById("ratioFill"),
  ratioEnValue: document.getElementById("ratioEnValue"),
  ratioJaValue: document.getElementById("ratioJaValue"),
  save: document.getElementById("save"),
  status: document.getElementById("status"),
  panelTitle: document.getElementById("panelTitle"),
  enableTitle: document.getElementById("enableTitle"),
  enableDesc: document.getElementById("enableDesc"),
  mixLanguageTitle: document.getElementById("mixLanguageTitle"),
  mixLanguageDesc: document.getElementById("mixLanguageDesc"),
  translateButtons: document.getElementById("translateButtons"),
  translateButtonsTitle: document.getElementById("translateButtonsTitle"),
  translateButtonsDesc: document.getElementById("translateButtonsDesc"),
  ttsVoice: document.getElementById("ttsVoice"),
  outputSettingsLabel: document.getElementById("outputSettingsLabel"),
  cacheLabel: document.getElementById("cacheLabel"),
  cacheHint: document.getElementById("cacheHint"),
  cacheStats: document.getElementById("cacheStats"),
  clearCache: document.getElementById("clearCache"),
  ttsVoiceLabel: document.getElementById("ttsVoiceLabel"),
  ttsPreviewBtn: document.getElementById("ttsPreviewBtn"),
  ttsPreviewLabel: document.getElementById("ttsPreviewLabel"),
  minTextLength: document.getElementById("minTextLength"),
  minTextLengthLabel: document.getElementById("minTextLengthLabel"),
  minTextLengthHint: document.getElementById("minTextLengthHint"),
  includeListLabel: document.getElementById("includeListLabel"),
  includeListHint: document.getElementById("includeListHint"),
  addCurrentSiteInclude: document.getElementById("addCurrentSiteInclude"),
  pageListInclude: document.getElementById("pageListInclude"),
  excludeListLabel: document.getElementById("excludeListLabel"),
  addCurrentSiteExclude: document.getElementById("addCurrentSiteExclude"),
  pageListExclude: document.getElementById("pageListExclude"),
  modelsLabel: document.getElementById("modelsLabel"),
  modelsHint: document.getElementById("modelsHint"),
  ratioTitle: document.getElementById("ratioTitle"),
  englishRatioMinus: document.getElementById("englishRatioMinus"),
  englishRatioPlus: document.getElementById("englishRatioPlus"),
  ratioEnLabel: document.getElementById("ratioEnLabel"),
  ratioJaLabel: document.getElementById("ratioJaLabel"),
  langJa: document.getElementById("langJa"),
  langEn: document.getElementById("langEn"),
  tabSettings: document.getElementById("tabSettings"),
  tabOutput: document.getElementById("tabOutput"),
  tabExplanation: document.getElementById("tabExplanation"),
  tabContentSettings: document.getElementById("tabContentSettings"),
  tabContentOutput: document.getElementById("tabContentOutput"),
  tabContentExplanation: document.getElementById("tabContentExplanation"),
  explanationSourceSection: document.getElementById("explanationSourceSection"),
  explanationSourceLabel: document.getElementById("explanationSourceLabel"),
  explanationSourceText: document.getElementById("explanationSourceText"),
  explanationTranslationText: document.getElementById("explanationTranslationText"),
  explanationEmpty: document.getElementById("explanationEmpty"),
  explanationEmptyTitle: document.getElementById("explanationEmptyTitle"),
  explanationEmptyDesc: document.getElementById("explanationEmptyDesc"),
  explanationResult: document.getElementById("explanationResult"),
  outputRatioMinus: document.getElementById("outputRatioMinus"),
  outputRatioPlus: document.getElementById("outputRatioPlus"),
  outputRatio: document.getElementById("outputRatio"),
  outputRatioFill: document.getElementById("outputRatioFill"),
  outputRatioTitle: document.getElementById("outputRatioTitle"),
  outputRatioValue: document.getElementById("outputRatioValue"),
  outputRatioValueLabel: document.getElementById("outputRatioValueLabel"),
  outputTypeParagraph: document.getElementById("outputTypeParagraph"),
  outputTypeParagraphLabel: document.getElementById("outputTypeParagraphLabel"),
  outputTypeFree: document.getElementById("outputTypeFree"),
  outputTypeFreeLabel: document.getElementById("outputTypeFreeLabel"),
  outputTypeQuiz: document.getElementById("outputTypeQuiz"),
  outputTypeQuizLabel: document.getElementById("outputTypeQuizLabel"),
  quizPanel: document.getElementById("quizPanel"),
  quizSituation: document.getElementById("quizSituation"),
  quizPrompt: document.getElementById("quizPrompt"),
  quizNextBtn: document.getElementById("quizNextBtn"),
  outputEmpty: document.getElementById("outputEmpty"),
  outputEmptyTitle: document.getElementById("outputEmptyTitle"),
  outputEmptyDesc: document.getElementById("outputEmptyDesc"),
  outputForm: document.getElementById("outputForm"),
  outputModeLabel: document.getElementById("outputModeLabel"),
  outputModeOpinion: document.getElementById("outputModeOpinion"),
  outputModeOpinionLabel: document.getElementById("outputModeOpinionLabel"),
  outputModeRephrase: document.getElementById("outputModeRephrase"),
  outputModeRephraseLabel: document.getElementById("outputModeRephraseLabel"),
  outputSourceLabel: document.getElementById("outputSourceLabel"),
  outputSourceText: document.getElementById("outputSourceText"),
  outputInputLabel: document.getElementById("outputInputLabel"),
  outputTimer: document.getElementById("outputTimer"),
  outputTimerReset: document.getElementById("outputTimerReset"),
  outputTextarea: document.getElementById("outputTextarea"),
  outputSend: document.getElementById("outputSend"),
  outputFeedbackSection: document.getElementById("outputFeedbackSection"),
  outputFeedbackLabel: document.getElementById("outputFeedbackLabel"),
  outputFeedback: document.getElementById("outputFeedback"),
  vocabSuggestSection: document.getElementById("vocabSuggestSection"),
  vocabSuggestLabel: document.getElementById("vocabSuggestLabel"),
  vocabSuggestList: document.getElementById("vocabSuggestList"),
  vocabTrackerTitle: document.getElementById("vocabTrackerTitle"),
  vocabAddBtn: document.getElementById("vocabAddBtn"),
  vocabAddForm: document.getElementById("vocabAddForm"),
  vocabAddEn: document.getElementById("vocabAddEn"),
  vocabAddSubmit: document.getElementById("vocabAddSubmit"),
  myExamplesTitle: document.getElementById("myExamplesTitle"),
  myExamplesAddBtn: document.getElementById("myExamplesAddBtn"),
  myExamplesAddForm: document.getElementById("myExamplesAddForm"),
  myExAddQuestion: document.getElementById("myExAddQuestion"),
  myExAddAnswer1: document.getElementById("myExAddAnswer1"),
  myExAddAnswer2: document.getElementById("myExAddAnswer2"),
  myExAddAnswer3: document.getElementById("myExAddAnswer3"),
  myExAddSubmit: document.getElementById("myExAddSubmit"),
  myExamplesList: document.getElementById("myExamplesList"),
  vocabSearch: document.getElementById("vocabSearch"),
  vocabList: document.getElementById("vocabList"),
  vocabModal: document.getElementById("vocabModal"),
  modalTitle: document.getElementById("modalTitle"),
  modalBody: document.getElementById("modalBody"),
  modalClose: document.getElementById("modalClose"),
  modalAnalyzePrompt: document.getElementById("modalAnalyzePrompt"),
  reviewMinus: document.getElementById("reviewMinus"),
  reviewCount: document.getElementById("reviewCount"),
  reviewPlus: document.getElementById("reviewPlus"),
  modalAnalyzeBtn: document.getElementById("modalAnalyzeBtn"),
  modalReanalyzeBtn: document.getElementById("modalReanalyzeBtn"),
  modalContent: document.getElementById("modalContent"),
};

let defaultSaveLabel = elements.save.textContent;
let currentLang = "ja";
let currentTab = "settings";
let currentOutputMode = "opinion";
let currentOutputType = "paragraph";
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
  elements.langJa.classList.toggle("is-active", currentLang === "ja");
  elements.langEn.classList.toggle("is-active", currentLang === "en");
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
  elements.outputTextarea.placeholder = currentOutputMode === "opinion"
    ? t.outputTextareaPlaceholderOpinion
    : t.outputTextareaPlaceholderRephrase;
  elements.outputSend.textContent = t.outputSend;
  elements.outputFeedbackLabel.textContent = t.outputFeedbackLabel;
  elements.vocabSuggestLabel.textContent = t.vocabSuggestLabel;
  elements.vocabTrackerTitle.textContent = t.vocabTrackerTitle;
  elements.vocabAddSubmit.textContent = t.vocabAdd;
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
    toggle.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    toggle.addEventListener("click", () => {
      input.type = input.type === "password" ? "text" : "password";
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
    pageListInclude: elements.pageListInclude.value,
    pageListExclude: elements.pageListExclude.value,
    models: getSelectedModels(),
    apiKeys: collectApiKeys(),
    englishRatio: Number(elements.englishRatio.value || 0),
    ttsVoice: elements.ttsVoice.value || "nova",
    outputRatio: Number(elements.outputRatio.value || 0),
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


function stepRange(input, delta, callback) {
  const step = Number(input.step) || 1;
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 100;
  input.value = Math.max(min, Math.min(max, Number(input.value) + delta * step));
  callback();
}

function setOutputMode(mode) {
  currentOutputMode = mode;
  elements.outputModeOpinion.checked = mode === "opinion";
  elements.outputModeRephrase.checked = mode === "rephrase";
  const t = getTranslations();
  elements.outputTextarea.placeholder = mode === "opinion"
    ? t.outputTextareaPlaceholderOpinion
    : t.outputTextareaPlaceholderRephrase;
}

let situationsData = null;

async function loadSituations() {
  if (situationsData) return situationsData;
  const url = chrome.runtime.getURL("situations.json");
  const resp = await fetch(url);
  situationsData = await resp.json();
  return situationsData;
}

async function generateQuiz() {
  const t = getTranslations();
  elements.quizPrompt.textContent = t.quizLoading;
  elements.quizPrompt.classList.add("is-loading");
  elements.quizNextBtn.disabled = true;

  const situations = await loadSituations();
  const picked = situations[Math.floor(Math.random() * situations.length)];
  elements.quizSituation.textContent = picked.situation;

  const res = await chrome.runtime.sendMessage({
    type: "mlg:generateQuiz",
    payload: { situation: picked.situation },
  });

  elements.quizPrompt.classList.remove("is-loading");
  elements.quizNextBtn.disabled = false;

  if (res && !res.error) {
    elements.quizPrompt.textContent = res.prompt;
  } else {
    elements.quizPrompt.textContent = res?.error || "Error";
  }
}

function setOutputType(type) {
  currentOutputType = type;
  elements.outputTypeParagraph.classList.toggle("is-active", type === "paragraph");
  elements.outputTypeFree.classList.toggle("is-active", type === "free");
  elements.outputTypeQuiz.classList.toggle("is-active", type === "quiz");
  elements.quizPanel.style.display = "none";
  const t = getTranslations();
  if (type === "free") {
    elements.outputEmpty.style.display = "none";
    elements.outputForm.style.display = "";
    elements.outputSourceText.parentElement.style.display = "none";
    elements.outputModeLabel.parentElement.style.display = "none";
    elements.outputTextarea.placeholder = t.outputFreeEmptyTitle;
    elements.outputTextarea.value = "";
    elements.outputFeedbackSection.style.display = "none";
    elements.vocabSuggestSection.style.display = "none";
    startOutputTimer();
  } else if (type === "quiz") {
    elements.outputEmpty.style.display = "none";
    elements.outputForm.style.display = "";
    elements.outputSourceText.parentElement.style.display = "none";
    elements.outputModeLabel.parentElement.style.display = "none";
    elements.quizPanel.style.display = "";
    elements.outputTextarea.placeholder = t.outputFreeEmptyTitle;
    elements.outputTextarea.value = "";
    elements.outputFeedbackSection.style.display = "none";
    elements.vocabSuggestSection.style.display = "none";
    startOutputTimer();
    generateQuiz();
  } else {
    elements.outputSourceText.parentElement.style.display = "";
    elements.outputModeLabel.parentElement.style.display = "";
    if (!elements.outputSourceText.textContent) {
      elements.outputForm.style.display = "none";
      elements.outputEmpty.style.display = "";
      elements.outputEmptyTitle.textContent = t.outputEmptyTitle;
      elements.outputEmptyDesc.textContent = t.outputEmptyDesc;
    }
  }
}

function updateOutputRatioLabel() {
  const value = Number(elements.outputRatio.value || 0);
  elements.outputRatioFill.style.width = `${value}%`;
  elements.outputRatioValue.textContent = `${value}%`;
  updateDirtyState();
}

let vocabItems = [];
let vocabSortKey = "alpha"; // "alpha" | "count" | "review"
let vocabSortAsc = true;
let lastMatchedVocab = [];

async function loadVocab() {
  const resp = await chrome.runtime.sendMessage({ type: "mlg:getVocab" });
  vocabItems = resp || [];
  renderVocabList();
}

async function addVocab(en, ja) {
  const resp = await chrome.runtime.sendMessage({
    type: "mlg:addVocab",
    payload: { en, ja, type: en.includes(" ") ? "phrase" : "word" },
  });
  vocabItems = resp || vocabItems;
  renderVocabList();
}

async function removeVocab(en) {
  const resp = await chrome.runtime.sendMessage({
    type: "mlg:removeVocab",
    payload: { en },
  });
  vocabItems = resp || vocabItems;
  renderVocabList();
}

let autoAnalyzeRunning = false;
let autoAnalyzeAbort = false;

const AUTO_ANALYZE_CONCURRENCY = 3;

async function analyzeOneVocab(item) {
  // Mark row as analyzing
  const row = elements.vocabList.querySelector(`[data-vocab-en="${item.en}"]`);
  if (row) row.classList.add("is-analyzing");

  const response = await chrome.runtime.sendMessage({
    type: "mlg:analyzeVocab",
    payload: { word: item.en },
  });
  if (response && !response.error) {
    const resp = await chrome.runtime.sendMessage({
      type: "mlg:updateVocab",
      payload: { en: item.en, fields: { frequency: response.frequency, analysis: response } },
    });
    if (resp) {
      vocabItems = resp;
      renderVocabList();
    }
  }
}

let autoAnalyzeGroup = null;

function updateAutoAnalyzeBtn() {
  const btn = elements.vocabList.querySelector(`.vocab-auto-analyze-btn[data-group="${autoAnalyzeGroup}"]`);
  if (!btn) return;
  const remaining = autoAnalyzeGroup === "unclassified"
    ? vocabItems.filter((v) => getFreqGroup(v) === "unclassified").length
    : vocabItems.filter((v) => getFreqGroup(v) === autoAnalyzeGroup && !v._reanalyzed).length;
  btn.textContent = `${getTranslations().vocabAutoAnalyzeStop} (${remaining})`;
}

async function startAutoAnalyze(group) {
  if (autoAnalyzeRunning) return;
  autoAnalyzeRunning = true;
  autoAnalyzeAbort = false;
  autoAnalyzeGroup = group;
  renderVocabList();

  let queue;
  if (group === "unclassified") {
    queue = vocabItems.filter((v) => getFreqGroup(v) === "unclassified").map((v) => v.en);
  } else {
    const targets = vocabItems.filter((v) => getFreqGroup(v) === group);
    targets.forEach((v) => { v._reanalyzed = false; });
    queue = targets.map((v) => v.en);
  }
  let idx = 0;

  async function worker() {
    while (idx < queue.length && !autoAnalyzeAbort) {
      const en = queue[idx++];
      const item = vocabItems.find((v) => v.en === en);
      if (!item) continue;
      updateAutoAnalyzeBtn();
      await analyzeOneVocab(item);
      if (item) item._reanalyzed = true;
    }
  }

  const workers = [];
  for (let i = 0; i < AUTO_ANALYZE_CONCURRENCY; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  autoAnalyzeRunning = false;
  autoAnalyzeAbort = false;
  renderVocabList();
}

function stopAutoAnalyze() {
  autoAnalyzeAbort = true;
  autoAnalyzeRunning = false;
  autoAnalyzeGroup = null;
  vocabItems.forEach((v) => { delete v._reanalyzed; });
  renderVocabList();
}

function getFreqGroup(item) {
  const f = item.frequency || "";
  if (f.includes("★★★★★")) return "5";
  if (f.includes("★★★★")) return "4";
  if (f.includes("★★★")) return "3";
  if (f.includes("★★")) return "2";
  if (f.includes("★")) return "1";
  return "unclassified";
}

function renderVocabList() {
  const t = getTranslations();
  const matchedSet = new Set(lastMatchedVocab.map((v) => v.toLowerCase()));
  const searchQuery = (elements.vocabSearch?.value || "").trim().toLowerCase();

  // Filter and group items by frequency
  const groups = { "5": [], "4": [], "3": [], "2": [], "1": [], unclassified: [] };
  vocabItems.forEach((item) => {
    if (searchQuery && !item.en.toLowerCase().includes(searchQuery)) return;
    groups[getFreqGroup(item)].push(item);
  });

  // Sort within each group
  const dir = vocabSortAsc ? 1 : -1;
  let sortFn;
  if (vocabSortKey === "count") {
    sortFn = (a, b) => (a.count - b.count) * dir || a.en.localeCompare(b.en);
  } else if (vocabSortKey === "review") {
    sortFn = (a, b) => ((a.reviewCount || 0) - (b.reviewCount || 0)) * dir || a.en.localeCompare(b.en);
  } else {
    sortFn = (a, b) => a.en.localeCompare(b.en) * dir;
  }
  Object.values(groups).forEach((g) => g.sort(sortFn));

  const groupOrder = [
    { key: "5", label: "★★★★★", desc: t.freqDesc5 },
    { key: "4", label: "★★★★", desc: t.freqDesc4 },
    { key: "3", label: "★★★", desc: t.freqDesc3 },
    { key: "2", label: "★★", desc: t.freqDesc2 },
    { key: "1", label: "★", desc: t.freqDesc1 },
    { key: "unclassified", label: t.vocabUnclassified, desc: "" },
  ];

  function arrow(key) {
    if (vocabSortKey !== key) return "";
    return vocabSortAsc ? " ▲" : " ▼";
  }
  let html = `<div class="vocab-header-row"><span class="vocab-header-en vocab-header-sortable" data-sort="alpha">${escapeHtml(t.vocabHeaderWord)}${arrow("alpha")}</span><span class="vocab-header-review vocab-header-sortable" data-sort="review">${escapeHtml(t.vocabHeaderReview)}${arrow("review")}</span><span class="vocab-header-count vocab-header-sortable" data-sort="count">${escapeHtml(t.vocabHeaderCount)}${arrow("count")}</span></div>`;
  for (const { key, label, desc } of groupOrder) {
    const items = groups[key];
    if (items.length === 0) continue;
    const infoIcon = desc ? `<span class="vocab-group-info" title="${escapeHtml(desc)}">i</span>` : "";
    if (key === "unclassified") {
      html += `<div class="vocab-group-header"><span class="vocab-group-label">${escapeHtml(label)}${infoIcon}</span><button class="vocab-auto-analyze-btn" data-group="unclassified">${autoAnalyzeRunning && autoAnalyzeGroup === "unclassified" ? t.vocabAutoAnalyzeStop : t.vocabAutoAnalyze}</button></div>`;
    } else {
      html += `<div class="vocab-group-header"><span class="vocab-group-label">${escapeHtml(label)}${infoIcon}</span><button class="vocab-auto-analyze-btn" data-group="${key}">${autoAnalyzeRunning && autoAnalyzeGroup === key ? t.vocabAutoAnalyzeStop : t.vocabReanalyzeGroup}</button></div>`;
    }
    for (const item of items) {
      const highlighted = matchedSet.has(item.en.toLowerCase()) ? " is-highlighted" : "";
      const zeroClass = item.count === 0 ? " is-zero" : "";
      const reviewZero = (item.reviewCount || 0) === 0 ? " is-zero" : "";
      html += `<div class="vocab-row${highlighted}" data-vocab-en="${escapeHtml(item.en)}">
        <span class="vocab-en">${escapeHtml(item.en)}</span>
        <span class="vocab-review${reviewZero}">${item.reviewCount || 0}</span>
        <span class="vocab-count${zeroClass}">${item.count}${t.vocabCount}</span>
        <button class="vocab-delete" data-en="${escapeHtml(item.en)}" title="Delete">&times;</button>
      </div>`;
    }
  }
  elements.vocabList.innerHTML = html;
  elements.vocabList.querySelectorAll(".vocab-row").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".vocab-delete")) return;
      openVocabModal(row.dataset.vocabEn);
    });
  });
  elements.vocabList.querySelectorAll(".vocab-delete").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeVocab(btn.dataset.en);
    });
  });
  elements.vocabList.querySelectorAll(".vocab-auto-analyze-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const group = btn.dataset.group;
      if (autoAnalyzeRunning) {
        stopAutoAnalyze();
      } else {
        startAutoAnalyze(group);
      }
    });
  });
  elements.vocabList.querySelectorAll(".vocab-header-sortable").forEach((el) => {
    el.addEventListener("click", () => {
      const key = el.dataset.sort;
      if (vocabSortKey === key) {
        vocabSortAsc = !vocabSortAsc;
      } else {
        vocabSortKey = key;
        vocabSortAsc = key === "alpha";
      }
      renderVocabList();
    });
  });
}

// --- My Examples ---
const MY_EXAMPLES_KEY = "mlg_my_examples";
let myExamples = [];
let myExTtsCache = {};
let myExTtsPlaying = null;

async function loadMyExamples() {
  const result = await chrome.storage.local.get(MY_EXAMPLES_KEY);
  myExamples = result[MY_EXAMPLES_KEY] || [];
  renderMyExamples();
}

async function saveMyExamples() {
  await chrome.storage.local.set({ [MY_EXAMPLES_KEY]: myExamples });
}

async function addMyExample(question, answers) {
  myExamples.push({ question, answers, id: Date.now() });
  await saveMyExamples();
  renderMyExamples();
}

async function removeMyExample(id) {
  myExamples = myExamples.filter((ex) => ex.id !== id);
  await saveMyExamples();
  renderMyExamples();
}

function renderMyExamples() {
  const h = escapeHtml;
  if (myExamples.length === 0) {
    elements.myExamplesList.innerHTML = "";
    return;
  }
  elements.myExamplesList.innerHTML = myExamples.map((ex) => {
    const answersHtml = ex.answers.map((a) =>
      `<div class="my-ex-answer"><span class="my-ex-answer-text">${h(a)}</span><button class="my-ex-tts-btn" data-tts="${h(a)}" title="再生">&#9655;</button></div>`
    ).join("");
    return `<div class="my-ex-item" data-id="${ex.id}">
      <div class="my-ex-question">
        <span class="my-ex-question-text">${h(ex.question)}</span>
        <button class="my-ex-tts-btn" data-tts="${h(ex.question)}" title="再生">&#9655;</button>
        <span class="my-ex-toggle">▼</span>
      </div>
      <div class="my-ex-answers">
        ${answersHtml}
        <div style="text-align:right;margin-top:4px;"><button class="my-ex-delete" data-id="${ex.id}" title="削除">&times;</button></div>
      </div>
    </div>`;
  }).join("");

  // Accordion toggle
  elements.myExamplesList.querySelectorAll(".my-ex-question").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest(".my-ex-tts-btn")) return;
      el.closest(".my-ex-item").classList.toggle("is-open");
    });
  });

  // Delete
  elements.myExamplesList.querySelectorAll(".my-ex-delete").forEach((btn) => {
    btn.addEventListener("click", () => removeMyExample(Number(btn.dataset.id)));
  });

  // TTS
  elements.myExamplesList.querySelectorAll(".my-ex-tts-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const text = btn.dataset.tts;
      if (!text) return;
      if (myExTtsPlaying) { myExTtsPlaying.pause(); myExTtsPlaying = null; }
      if (myExTtsCache[text]) {
        myExTtsPlaying = new Audio(myExTtsCache[text]);
        myExTtsPlaying.play();
        return;
      }
      btn.disabled = true;
      btn.textContent = "…";
      const res = await chrome.runtime.sendMessage({
        type: "mlg:tts",
        payload: { text, voice: elements.ttsVoice?.value || "nova" },
      });
      btn.disabled = false;
      btn.innerHTML = "&#9655;";
      if (res && !res.error) {
        myExTtsCache[text] = res.dataUrl;
        myExTtsPlaying = new Audio(res.dataUrl);
        myExTtsPlaying.play();
      }
    });
  });
}

let currentModalWord = "";
let modalTtsCache = {};
let modalTtsPlaying = null;

function openVocabModal(word) {
  currentModalWord = word;
  elements.modalTitle.textContent = word;
  elements.vocabModal.style.display = "";
  const t = getTranslations();
  elements.modalAnalyzeBtn.textContent = t.modalAnalyze;
  elements.modalAnalyzeBtn.disabled = false;

  // Review count & cached analysis
  const item = vocabItems.find((v) => v.en.toLowerCase() === word.toLowerCase());
  elements.reviewCount.textContent = (item?.reviewCount || 0);
  if (item && item.analysis) {
    renderAnalysis(item.analysis);
  } else {
    elements.modalAnalyzePrompt.style.display = "";
    elements.modalContent.style.display = "none";
    elements.modalContent.innerHTML = "";
    elements.modalReanalyzeBtn.style.display = "none";
  }
}

function closeVocabModal() {
  if (modalTtsPlaying) { modalTtsPlaying.pause(); modalTtsPlaying = null; }
  modalTtsCache = {};
  elements.vocabModal.style.display = "none";
  currentModalWord = "";
}

function renderAnalysis(data) {
  const t = getTranslations();
  const h = escapeHtml;

  function freqClass(f) {
    if (f.includes("★★★★★") || f.includes("★★★★")) return "freq-high";
    if (f.includes("★★★")) return "freq-mid";
    return "freq-low";
  }
  function diffClass(d) {
    if (d.includes("初級") || d.toLowerCase().includes("easy")) return "diff-easy";
    if (d.includes("上級") || d.toLowerCase().includes("hard")) return "diff-hard";
    return "diff-mid";
  }

  let html = "";

  // Meaning
  html += `<div class="modal-section">
    <div class="modal-section-title">${h(t.modalMeaning)}</div>
    <div class="modal-example"><div class="modal-field-label">${h(t.modalDefinition)}</div><div class="modal-field-value">${h(data.meaning.definition)}</div></div>
    <div class="modal-example"><div class="modal-field-label">${h(t.modalCoreImage)}</div><div class="modal-field-value">${h(data.meaning.coreImage)}</div></div>
    <div class="modal-example"><div class="modal-field-label">${h(t.modalNativeFeel)}</div><div class="modal-field-value">${h(data.meaning.nativeFeel)}</div></div>
    <div class="modal-example"><div class="modal-field-label">${h(t.modalUsageScene)}</div><div class="modal-field-value">${h(data.meaning.usageScene)}</div></div>
  </div>`;

  // Frequency & Difficulty
  html += `<div class="modal-section">
    <div class="modal-field"><div class="modal-field-label">${h(t.modalFrequency)}</div><div class="modal-field-value"><span class="modal-badge ${freqClass(data.frequency)}">${h(data.frequency)}</span></div></div>
    <div class="modal-field"><div class="modal-field-label">${h(t.modalDifficulty)}</div><div class="modal-field-value"><span class="modal-badge ${diffClass(data.difficulty)}">${h(data.difficulty)}</span></div></div>
  </div>`;

  // Etymology
  html += `<div class="modal-section">
    <div class="modal-section-title">${h(t.modalEtymology)}</div>
    <div class="modal-field-value">${h(data.etymology)}</div>
  </div>`;

  // Pronunciation
  html += `<div class="modal-section">
    <div class="modal-section-title">${h(t.modalPronunciation)}</div>
    <div class="modal-field"><div class="modal-field-label">${h(t.modalIpa)}</div><div class="modal-field-value">${h(data.pronunciation.ipa)}</div></div>
    <div class="modal-field"><a class="modal-link" href="${h(data.pronunciation.googleTranslateUrl)}" target="_blank" rel="noopener">${h(t.modalListen)} (Google Translate) ↗</a></div>
  </div>`;

  // Examples
  html += `<div class="modal-section">
    <div class="modal-section-title">${h(t.modalExamples)}</div>
    ${(data.examples || []).map((ex) => `<div class="modal-example"><div class="modal-example-row"><div class="modal-example-en">${h(ex.en)}</div><button class="modal-tts-btn" data-text="${h(ex.en)}" title="再生">&#9655;</button></div><div class="modal-example-ja">${h(ex.ja)}</div></div>`).join("")}
  </div>`;

  // Collocations
  html += `<div class="modal-section">
    <div class="modal-section-title">${h(t.modalCollocations)}</div>
    ${(data.collocations || []).map((c) => `<div class="modal-example"><div class="modal-example-row"><div class="modal-example-en">${h(c.en)}</div><button class="modal-tts-btn" data-text="${h(c.en)}" title="再生">&#9655;</button></div><div class="modal-example-ja">${h(c.ja)}</div></div>`).join("")}
  </div>`;

  // Visual (fixed links)
  const encoded = encodeURIComponent(currentModalWord);
  html += `<div class="modal-section">
    <div class="modal-section-title">${h(t.modalVisual)}</div>
    <div class="modal-visual-item"><div class="modal-visual-label">${h(t.modalImage)}</div><a class="modal-link" href="https://www.google.co.jp/search?q=${encoded}&hl=en&tbm=isch" target="_blank" rel="noopener">Google Images ↗</a></div>
    <div class="modal-visual-item"><div class="modal-visual-label">${h(t.modalYoutube)}</div><a class="modal-link" href="https://youglish.com/pronounce/${encoded}/english" target="_blank" rel="noopener">YouGlish ↗</a></div>
    <div class="modal-visual-item"><div class="modal-visual-label">${h(t.modalMovie)}</div><a class="modal-link" href="https://www.playphrase.me/#/search?q=${encoded}" target="_blank" rel="noopener">PlayPhrase.me ↗</a></div>
  </div>`;

  // Related words
  html += `<div class="modal-section">
    <div class="modal-section-title">${h(t.modalRelated)}</div>
    <div class="modal-field"><div class="modal-field-label">${h(t.modalSynonyms)}</div><div class="modal-tags">${(data.relatedWords.synonyms || []).map((w) => `<span class="modal-tag">${h(w)}</span>`).join("")}</div></div>
    <div class="modal-field"><div class="modal-field-label">${h(t.modalAntonyms)}</div><div class="modal-tags">${(data.relatedWords.antonyms || []).map((w) => `<span class="modal-tag">${h(w)}</span>`).join("")}</div></div>
    <div class="modal-field"><div class="modal-field-label">${h(t.modalDerivatives)}</div><div class="modal-tags">${(data.relatedWords.derivatives || []).map((w) => `<span class="modal-tag">${h(w)}</span>`).join("")}</div></div>
  </div>`;

  elements.modalContent.innerHTML = html;
  elements.modalContent.style.display = "";
  elements.modalAnalyzePrompt.style.display = "none";
  elements.modalReanalyzeBtn.textContent = t.modalReanalyze;
  elements.modalReanalyzeBtn.style.display = "";

  // Bind TTS buttons
  elements.modalContent.querySelectorAll(".modal-tts-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = btn.dataset.text;
      if (!text) return;
      // Stop any currently playing modal audio
      if (modalTtsPlaying) { modalTtsPlaying.pause(); modalTtsPlaying = null; }
      // Check cache
      if (modalTtsCache[text]) {
        modalTtsPlaying = new Audio(modalTtsCache[text]);
        modalTtsPlaying.play();
        return;
      }
      btn.disabled = true;
      btn.textContent = "…";
      const res = await chrome.runtime.sendMessage({
        type: "mlg:tts",
        payload: { text, voice: elements.ttsVoice?.value || "nova" },
      });
      btn.disabled = false;
      btn.innerHTML = "&#9655;";
      if (res && !res.error) {
        modalTtsCache[text] = res.dataUrl;
        modalTtsPlaying = new Audio(res.dataUrl);
        modalTtsPlaying.play();
      }
    });
  });
}

function renderVocabSuggestions(suggestions) {
  if (!suggestions || suggestions.length === 0) {
    elements.vocabSuggestSection.style.display = "none";
    return;
  }
  elements.vocabSuggestSection.style.display = "";
  elements.vocabSuggestList.innerHTML = suggestions
    .map((s) => `<div class="vocab-suggest-item">
      <span class="vocab-suggest-text">
        <span class="vocab-suggest-en">${escapeHtml(s.en)}</span>
        <span class="vocab-suggest-ja">${escapeHtml(s.ja)}</span>
      </span>
      <button class="vocab-suggest-add" data-en="${escapeHtml(s.en)}" data-ja="${escapeHtml(s.ja)}">+</button>
    </div>`)
    .join("");
  elements.vocabSuggestList.querySelectorAll(".vocab-suggest-add").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await addVocab(btn.dataset.en, btn.dataset.ja);
      btn.closest(".vocab-suggest-item").remove();
      if (elements.vocabSuggestList.children.length === 0) {
        elements.vocabSuggestSection.style.display = "none";
      }
    });
  });
}

function renderFeedback(result) {
  const { corrected, feedback, overall } = result;
  let html = "";

  if (corrected) {
    html += `<div class="feedback-corrected"><div class="feedback-corrected-row"><span class="feedback-corrected-text">${escapeHtml(corrected)}</span><button class="feedback-tts-btn" data-tts-text="${escapeHtml(corrected)}" title="再生">&#9655;</button></div></div>`;
  }

  if (feedback && feedback.length > 0) {
    html += `<div class="feedback-items">`;
    feedback.forEach((item) => {
      html += `<div class="feedback-item">`;
      html += `<div class="feedback-diff"><del>${escapeHtml(item.original)}</del> → <ins>${escapeHtml(item.corrected)}</ins></div>`;
      html += `<div class="feedback-explanation">${escapeHtml(item.explanation)}</div>`;
      html += `</div>`;
    });
    html += `</div>`;
  }

  if (overall) {
    html += `<div class="feedback-overall">${escapeHtml(overall)}</div>`;
  }

  const alts = result.alternativeExamples || [];
  if (alts.length > 0) {
    const t = getTranslations();
    html += `<div class="feedback-alternatives">`;
    html += `<div class="feedback-alternatives-title">${escapeHtml(t.alternativeTitle)}</div>`;
    alts.forEach((alt) => {
      html += `<div class="modal-example">`;
      html += `<div class="feedback-alt-angle">${escapeHtml(alt.angle)}</div>`;
      html += `<div class="modal-example-row"><div class="modal-example-en">${escapeHtml(alt.en)}</div><button class="feedback-tts-btn" data-tts-text="${escapeHtml(alt.en)}" title="再生">&#9655;</button></div>`;
      html += `<div class="modal-example-ja">${escapeHtml(alt.ja)}</div>`;
      html += `</div>`;
    });
    html += `</div>`;
  }

  if (!html) {
    const t = getTranslations();
    html = `<div class="feedback-perfect">${t.outputPerfect}</div>`;
  }

  elements.outputFeedback.innerHTML = html;

  // Bind feedback TTS buttons
  if (feedbackTtsPlaying) { feedbackTtsPlaying.pause(); feedbackTtsPlaying = null; }
  feedbackTtsCache = {};
  elements.outputFeedback.querySelectorAll(".feedback-tts-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = btn.dataset.ttsText;
      if (!text) return;
      if (feedbackTtsPlaying) { feedbackTtsPlaying.pause(); feedbackTtsPlaying = null; }
      if (feedbackTtsCache[text]) {
        feedbackTtsPlaying = new Audio(feedbackTtsCache[text]);
        feedbackTtsPlaying.play();
        return;
      }
      btn.disabled = true;
      btn.textContent = "…";
      const res = await chrome.runtime.sendMessage({
        type: "mlg:tts",
        payload: { text, voice: elements.ttsVoice?.value || "nova" },
      });
      btn.disabled = false;
      btn.innerHTML = "&#9655;";
      if (res && !res.error) {
        feedbackTtsCache[text] = res.dataUrl;
        feedbackTtsPlaying = new Audio(res.dataUrl);
        feedbackTtsPlaying.play();
      }
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

let currentExplanationToken = null;

function renderExplanation(result) {
  const t = getTranslations();
  const chunks = result.chunks || [];
  const grammarPoints = result.grammarPoints || [];
  const vocabulary = result.vocabulary || [];
  const readingSteps = result.readingSteps || [];
  let html = "";

  html += `<div class="explanation-card">`;
  if (result.headline) {
    html += `<div class="explanation-headline">${escapeHtml(result.headline)}</div>`;
  }
  if (result.translation) {
    html += `<div>${escapeHtml(result.translation)}</div>`;
  }
  if (result.overview) {
    html += `<div style="margin-top:8px;">${escapeHtml(result.overview)}</div>`;
  }
  html += `</div>`;

  if (chunks.length > 0) {
    html += `<div class="explanation-card"><div class="explanation-card-title">${escapeHtml(t.explanationChunks)}</div>`;
    chunks.forEach((chunk) => {
      html += `<div class="explanation-chunk">`;
      html += `<div><span class="explanation-chunk-text">${escapeHtml(chunk.text)}</span><span class="explanation-chunk-role">${escapeHtml(chunk.role)}</span></div>`;
      html += `<div>${escapeHtml(chunk.explanation)}</div>`;
      html += `</div>`;
    });
    html += `</div>`;
  }

  if (grammarPoints.length > 0) {
    html += `<div class="explanation-card"><div class="explanation-card-title">${escapeHtml(t.explanationGrammar)}</div><ul class="explanation-list">`;
    grammarPoints.forEach((item) => {
      html += `<li><strong>${escapeHtml(item.title)}</strong>: ${escapeHtml(item.explanation)}</li>`;
    });
    html += `</ul></div>`;
  }

  if (vocabulary.length > 0) {
    html += `<div class="explanation-card"><div class="explanation-card-title">${escapeHtml(t.explanationVocabulary)}</div><ul class="explanation-list">`;
    vocabulary.forEach((item) => {
      html += `<li><strong>${escapeHtml(item.term)}</strong>: ${escapeHtml(item.meaning)}<br>${escapeHtml(item.nuance)}</li>`;
    });
    html += `</ul></div>`;
  }

  if (readingSteps.length > 0) {
    html += `<div class="explanation-card"><div class="explanation-card-title">${escapeHtml(t.explanationSteps)}</div><ol class="explanation-list">`;
    readingSteps.forEach((step) => {
      html += `<li>${escapeHtml(step)}</li>`;
    });
    html += `</ol></div>`;
  }

  elements.explanationResult.innerHTML = html;
}

async function showExplanation(payload) {
  const text = String(payload?.text || payload?.englishText || "").trim();
  if (!text) return;

  const t = getTranslations();
  const token = `${Date.now()}-${Math.random()}`;
  currentExplanationToken = token;

  switchTab("explanation");
  elements.explanationSourceSection.style.display = "";
  elements.explanationSourceText.textContent = text;

  const japaneseText = String(payload.japaneseText || "").trim();
  if (japaneseText && japaneseText !== text) {
    elements.explanationTranslationText.style.display = "";
    elements.explanationTranslationText.textContent = `${t.explanationTranslationLabel}: ${japaneseText}`;
  } else {
    elements.explanationTranslationText.style.display = "none";
    elements.explanationTranslationText.textContent = "";
  }

  elements.explanationEmpty.style.display = "none";
  elements.explanationResult.style.display = "";
  elements.explanationResult.innerHTML = `<div class="feedback-loading">${escapeHtml(t.explanationLoading)}</div>`;
  chrome.runtime.sendMessage({ type: "mlg:clearPendingExplanation" }).catch(() => {});

  const response = await chrome.runtime.sendMessage({
    type: "mlg:explainSentence",
    payload,
  });
  if (currentExplanationToken !== token) return;

  if (!response || response.error) {
    elements.explanationResult.innerHTML = `<div class="feedback-error">${escapeHtml(response?.error || t.explanationError)}</div>`;
    return;
  }
  renderExplanation(response);
}

let currentOutputOrigin = "";
let feedbackTtsCache = {};
let feedbackTtsPlaying = null;

let outputTimerInterval = null;
let outputTimerStart = null;

function formatTimer(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function startOutputTimer() {
  stopOutputTimer();
  outputTimerStart = Date.now();
  elements.outputTimer.textContent = "0:00";
  outputTimerInterval = setInterval(() => {
    elements.outputTimer.textContent = formatTimer(Date.now() - outputTimerStart);
  }, 1000);
}

function stopOutputTimer() {
  if (outputTimerInterval) {
    clearInterval(outputTimerInterval);
    outputTimerInterval = null;
  }
}

function resetOutputTimer() {
  outputTimerStart = Date.now();
  elements.outputTimer.textContent = "0:00";
}

function showOutputForm(text, origin) {
  if (feedbackTtsPlaying) { feedbackTtsPlaying.pause(); feedbackTtsPlaying = null; }
  feedbackTtsCache = {};
  currentOutputOrigin = origin || "";
  setOutputType("paragraph");
  switchTab("output");
  elements.outputEmpty.style.display = "none";
  elements.outputSourceText.parentElement.style.display = "";
  elements.outputModeLabel.parentElement.style.display = "";
  elements.outputForm.style.display = "";
  elements.outputSourceText.textContent = text;
  elements.outputTextarea.value = "";
  elements.outputFeedbackSection.style.display = "none";
  elements.outputFeedback.textContent = "";
  elements.vocabSuggestSection.style.display = "none";
  startOutputTimer();
  elements.outputTextarea.focus();
}

function switchTab(tab) {
  currentTab = tab;
  const isSettings = tab === "settings";
  const isOutput = tab === "output";
  const isExplanation = tab === "explanation";
  elements.tabSettings.classList.toggle("is-active", isSettings);
  elements.tabOutput.classList.toggle("is-active", isOutput);
  elements.tabExplanation.classList.toggle("is-active", isExplanation);
  elements.tabContentSettings.classList.toggle("is-active", isSettings);
  elements.tabContentOutput.classList.toggle("is-active", isOutput);
  elements.tabContentExplanation.classList.toggle("is-active", isExplanation);
  elements.save.style.display = isSettings ? "" : "none";
  elements.status.style.display = isSettings ? "" : "none";
}

function updateRatioLabel() {
  const value = Number(elements.englishRatio.value || 0);
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

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function refreshCacheStats() {
  const t = getTranslations();
  const stats = await chrome.runtime.sendMessage({ type: "mlg:getCacheStats" });
  elements.cacheStats.textContent = t.cacheStats(stats.entries, formatBytes(stats.bytes));
}

async function clearCache() {
  const t = getTranslations();
  elements.clearCache.disabled = true;
  await chrome.runtime.sendMessage({ type: "mlg:clearCache" });
  await refreshCacheStats();
  elements.clearCache.textContent = t.cacheCleared;
  setTimeout(() => {
    elements.clearCache.textContent = getTranslations().cacheClear;
    elements.clearCache.disabled = false;
  }, 1200);
}

async function saveConfig() {
  const config = collectFormState();
  await chrome.storage.local.set({ [STORAGE_KEY]: config });
  setSavedState(collectFormState());
  const t = getTranslations();
  elements.save.textContent = t.saved;
  setTimeout(() => {
    elements.save.textContent = defaultSaveLabel;
  }, 1200);
}

async function init() {
  const [config, lang] = await Promise.all([loadConfig(), loadLanguage()]);
  currentLang = lang;
  elements.enabled.checked = config.enabled;
  elements.mixLanguage.checked = config.mixLanguage;
  elements.translateButtons.checked = config.translateButtons;
  // Populate TTS voice dropdown
  elements.ttsVoice.innerHTML = "";
  TTS_VOICES.forEach((v) => {
    const o = document.createElement("option");
    o.value = v.value;
    o.textContent = v.label;
    elements.ttsVoice.appendChild(o);
  });
  elements.ttsVoice.value = config.ttsVoice || "nova";
  elements.minTextLength.value = config.minTextLength;
  elements.pageListInclude.value = config.pageListInclude ?? "";
  elements.pageListExclude.value = config.pageListExclude || "";
  const models = config.models || [];
  elements.englishRatio.value = config.englishRatio;
  elements.outputRatio.value = config.outputRatio;
  applyLanguage();
  refreshCacheStats().catch((err) => console.warn("[mlg:popup] cache stats failed:", err.message));
  updateOutputRatioLabel();
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
  elements.ttsVoice.addEventListener("change", updateDirtyState);
  let ttsPreviewAudio = null;
  elements.ttsPreviewBtn.addEventListener("click", async () => {
    if (ttsPreviewAudio) { ttsPreviewAudio.pause(); ttsPreviewAudio = null; }
    const t = getTranslations();
    elements.ttsPreviewBtn.disabled = true;
    elements.ttsPreviewLabel.textContent = t.ttsPreviewLoading;
    const voice = elements.ttsVoice.value || "nova";
    const res = await chrome.runtime.sendMessage({
      type: "mlg:tts",
      payload: { text: "Hello! This is how I sound. Nice to meet you.", voice },
    });
    elements.ttsPreviewBtn.disabled = false;
    elements.ttsPreviewLabel.textContent = t.ttsPreview;
    if (res && !res.error) {
      ttsPreviewAudio = new Audio(res.dataUrl);
      ttsPreviewAudio.play();
    }
  });
  elements.minTextLength.addEventListener("input", updateDirtyState);
  elements.englishRatio.addEventListener("input", updateRatioLabel);
  elements.englishRatioMinus.addEventListener("click", () => stepRange(elements.englishRatio, -1, updateRatioLabel));
  elements.englishRatioPlus.addEventListener("click", () => stepRange(elements.englishRatio, 1, updateRatioLabel));
  elements.pageListInclude.addEventListener("input", updateDirtyState);
  elements.pageListExclude.addEventListener("input", updateDirtyState);
  async function addCurrentSiteTo(textarea) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;
    const url = new URL(tab.url);
    const pattern = `${url.origin}/*`;
    const current = textarea.value.trim();
    const lines = current ? current.split("\n").map(l => l.trim()).filter(Boolean) : [];
    if (lines.includes(pattern)) return;
    lines.push(pattern);
    textarea.value = lines.join("\n");
    textarea.scrollTop = textarea.scrollHeight;
    updateDirtyState();
  }
  elements.addCurrentSiteInclude.addEventListener("click", () => addCurrentSiteTo(elements.pageListInclude));
  elements.addCurrentSiteExclude.addEventListener("click", () => addCurrentSiteTo(elements.pageListExclude));
  elements.outputRatio.addEventListener("input", updateOutputRatioLabel);
  elements.outputRatioMinus.addEventListener("click", () => stepRange(elements.outputRatio, -1, updateOutputRatioLabel));
  elements.outputRatioPlus.addEventListener("click", () => stepRange(elements.outputRatio, 1, updateOutputRatioLabel));
  elements.tabSettings.addEventListener("click", () => {
    switchTab("settings");
    refreshCacheStats();
  });
  elements.clearCache.addEventListener("click", clearCache);
  elements.tabOutput.addEventListener("click", () => switchTab("output"));
  elements.tabExplanation.addEventListener("click", () => switchTab("explanation"));
  elements.outputTypeParagraph.addEventListener("click", () => setOutputType("paragraph"));
  elements.outputTypeFree.addEventListener("click", () => setOutputType("free"));
  elements.outputTypeQuiz.addEventListener("click", () => setOutputType("quiz"));
  elements.quizNextBtn.addEventListener("click", () => generateQuiz());
  elements.outputTimerReset.addEventListener("click", resetOutputTimer);
  elements.outputModeOpinion.addEventListener("change", () => setOutputMode("opinion"));
  elements.outputModeRephrase.addEventListener("change", () => setOutputMode("rephrase"));
  elements.outputSend.addEventListener("click", async () => {
    const userText = elements.outputTextarea.value.trim();
    if (!userText) return;
    const sourceText = (currentOutputType === "free" || currentOutputType === "quiz") ? "" : elements.outputSourceText.textContent;
    const t = getTranslations();
    elements.outputSend.disabled = true;
    elements.outputSend.textContent = t.outputSending;
    elements.outputFeedbackSection.style.display = "";
    elements.outputFeedback.innerHTML = `<div class="feedback-loading">${t.outputSending}</div>`;

    const quizContext = currentOutputType === "quiz" ? elements.quizPrompt.textContent : "";
    const response = await chrome.runtime.sendMessage({
      type: "mlg:feedback",
      payload: { sourceText: sourceText || quizContext, userText, mode: currentOutputType === "quiz" ? "quiz" : currentOutputMode },
    });

    elements.outputSend.disabled = false;
    elements.outputSend.textContent = t.outputSend;

    if (!response || response.error) {
      elements.outputFeedback.innerHTML = `<div class="feedback-error">${response?.error || "Unknown error"}</div>`;
      return;
    }
    renderFeedback(response);
    lastMatchedVocab = response.matchedVocab || [];
    renderVocabSuggestions(response.vocabSuggestions || []);
    await loadVocab();
    // Mark norma as done
    if (sourceText && currentOutputOrigin) {
      const textKey = `${currentOutputOrigin}::${sourceText}`;
      chrome.runtime.sendMessage({ type: "mlg:normaDone", payload: { textKey } });
    }
  });
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "mlg:openOutput" && message.payload?.text) {
      showOutputForm(message.payload.text, message.payload.origin);
    }
    if (message.type === "mlg:openExplanation" && message.payload?.text) {
      showExplanation(message.payload);
    }
  });
  const pendingExplanation = await chrome.runtime.sendMessage({ type: "mlg:getPendingExplanation" });
  if (pendingExplanation?.text) {
    showExplanation(pendingExplanation);
  }
  async function updateReviewCount(delta) {
    if (!currentModalWord) return;
    const item = vocabItems.find((v) => v.en.toLowerCase() === currentModalWord.toLowerCase());
    if (!item) return;
    const newCount = Math.max(0, (item.reviewCount || 0) + delta);
    const resp = await chrome.runtime.sendMessage({
      type: "mlg:updateVocab",
      payload: { en: currentModalWord, fields: { reviewCount: newCount } },
    });
    if (resp) {
      vocabItems = resp;
      elements.reviewCount.textContent = newCount;
      renderVocabList();
    }
  }
  elements.reviewMinus.addEventListener("click", () => updateReviewCount(-1));
  elements.reviewPlus.addEventListener("click", () => updateReviewCount(1));
  elements.modalClose.addEventListener("click", closeVocabModal);
  elements.vocabModal.addEventListener("click", (e) => {
    if (e.target === elements.vocabModal) closeVocabModal();
  });
  async function runAnalysis() {
    if (!currentModalWord) return;
    const t = getTranslations();
    elements.modalAnalyzeBtn.disabled = true;
    elements.modalAnalyzeBtn.textContent = t.modalAnalyzing;
    elements.modalReanalyzeBtn.style.display = "none";
    elements.modalContent.innerHTML = `<div class="modal-loading">${t.modalAnalyzing}</div>`;
    elements.modalContent.style.display = "";
    elements.modalAnalyzePrompt.style.display = "none";
    const response = await chrome.runtime.sendMessage({
      type: "mlg:analyzeVocab",
      payload: { word: currentModalWord },
    });
    elements.modalAnalyzeBtn.disabled = false;
    elements.modalAnalyzeBtn.textContent = t.modalAnalyze;
    if (!response || response.error) {
      elements.modalContent.innerHTML = `<div class="feedback-error">${escapeHtml(response?.error || "Unknown error")}</div>`;
      elements.modalAnalyzePrompt.style.display = "";
      elements.modalReanalyzeBtn.style.display = "";
      return;
    }
    renderAnalysis(response);
    // Save full analysis to vocab item
    const resp = await chrome.runtime.sendMessage({
      type: "mlg:updateVocab",
      payload: { en: currentModalWord, fields: { frequency: response.frequency, analysis: response } },
    });
    if (resp) {
      vocabItems = resp;
      renderVocabList();
    }
  }
  elements.modalAnalyzeBtn.addEventListener("click", runAnalysis);
  elements.modalReanalyzeBtn.addEventListener("click", runAnalysis);
  elements.vocabSearch.addEventListener("input", () => renderVocabList());
  elements.vocabAddBtn.addEventListener("click", () => {
    const form = elements.vocabAddForm;
    form.style.display = form.style.display === "none" ? "" : "none";
    if (form.style.display !== "none") elements.vocabAddEn.focus();
  });
  elements.vocabAddSubmit.addEventListener("click", async () => {
    const en = elements.vocabAddEn.value.trim();
    if (!en) return;
    await addVocab(en, "");
    elements.vocabAddEn.value = "";
    elements.vocabAddForm.style.display = "none";
  });
  loadVocab();
  loadMyExamples();
  elements.myExamplesAddBtn.addEventListener("click", () => {
    const form = elements.myExamplesAddForm;
    form.style.display = form.style.display === "none" ? "" : "none";
    if (form.style.display !== "none") elements.myExAddQuestion.focus();
  });
  elements.myExAddSubmit.addEventListener("click", async () => {
    const q = elements.myExAddQuestion.value.trim();
    if (!q) return;
    const answers = [
      elements.myExAddAnswer1.value.trim(),
      elements.myExAddAnswer2.value.trim(),
      elements.myExAddAnswer3.value.trim(),
    ].filter(Boolean);
    if (answers.length === 0) return;
    await addMyExample(q, answers);
    elements.myExAddQuestion.value = "";
    elements.myExAddAnswer1.value = "";
    elements.myExAddAnswer2.value = "";
    elements.myExAddAnswer3.value = "";
    elements.myExamplesAddForm.style.display = "none";
  });
  elements.save.addEventListener("click", saveConfig);
  elements.langJa.addEventListener("click", () => {
    setLanguage("ja");
  });
  elements.langEn.addEventListener("click", () => {
    setLanguage("en");
  });
}

init().catch((e) => {
  console.error("[mlg:popup] init failed:", e);
});
