import type { Language } from "@/utils/messages";

export interface Translations {
  title: string;
  subtitle: string;
  enable: string;
  enableDesc: string;
  mixLanguage: string;
  mixLanguageDesc: string;
  optIn: string;
  optOut: string;
  optInDesc: string;
  optOutDesc: string;
  pageList: string;
  pageListPlaceholder: string;
  models: string;
  modelsHint: string;
  customModelPlaceholder: string;
  ratio: string;
  english: string;
  japanese: string;
  translateButtons: string;
  translateButtonsDesc: string;
  minTextLength: string;
  minTextLengthHint: string;
  save: string;
  saved: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    customModelPlaceholder: "Enter a model ID (e.g. openrouter/meta-llama/llama-3.3-70b-instruct)",
    enable: "Enable translation",
    enableDesc: "Turn on automatic translation",
    english: "English",
    japanese: "Japanese",
    minTextLength: "Min text length",
    minTextLengthHint: "Text shorter than this will not be translated",
    mixLanguage: "Mix languages",
    mixLanguageDesc: "Randomly mix languages per sentence",
    models: "Model chain",
    modelsHint: "Fallback in priority order (empty = skip)",
    optIn: "Opt-in",
    optInDesc: "Only translate specified pages",
    optOut: "Opt-out",
    optOutDesc: "Exclude specified pages",
    pageList: "Page list",
    pageListPlaceholder: "Enter URLs, one per line\ne.g. https://example.com/*",
    ratio: "Language ratio",
    save: "Save",
    saved: "Saved!",
    subtitle: "Duolingo-inspired rounded layout",
    title: "Mazelingo Settings",
    translateButtons: "Translate buttons",
    translateButtonsDesc: "Also translate text inside buttons",
  },
  ja: {
    customModelPlaceholder: "モデルIDを入力（例: openrouter/meta-llama/llama-3.3-70b-instruct）",
    enable: "翻訳を有効にする",
    enableDesc: "自動翻訳機能をオンにします",
    english: "英語",
    japanese: "日本語",
    minTextLength: "最小文字数",
    minTextLengthHint: "この文字数未満のテキストは翻訳しない",
    mixLanguage: "言語をミックス",
    mixLanguageDesc: "文ごとにランダムに言語を混ぜる",
    models: "モデルチェーン",
    modelsHint: "優先順にフォールバック（空欄はスキップ）",
    optIn: "オプトイン",
    optInDesc: "指定したページのみ翻訳",
    optOut: "オプトアウト",
    optOutDesc: "指定したページを除外",
    pageList: "ページリスト",
    pageListPlaceholder: "URLを1行ずつ入力\n例: https://example.com/*",
    ratio: "言語の割合",
    save: "保存",
    saved: "保存しました！",
    subtitle: "Duolingo風の丸みデザイン",
    title: "Mazelingo 設定",
    translateButtons: "ボタンを翻訳",
    translateButtonsDesc: "ボタン内のテキストも翻訳する",
  },
};

export function getTranslations(lang: Language): Translations {
  return translations[lang];
}
