type ElOf<T> = T extends "input"
  ? HTMLInputElement
  : T extends "select"
    ? HTMLSelectElement
    : T extends "textarea"
      ? HTMLTextAreaElement
      : T extends "button"
        ? HTMLButtonElement
        : HTMLElement;

const elTags = {
  apiKeysSection: "div",
  customModel0: "input",
  customModel1: "input",
  customModel2: "input",
  enableDesc: "div",
  enableTitle: "div",
  enabled: "input",
  englishRatio: "input",
  langEn: "button",
  langJa: "button",
  minTextLength: "input",
  minTextLengthHint: "div",
  minTextLengthLabel: "div",
  mixLanguage: "input",
  mixLanguageDesc: "div",
  mixLanguageTitle: "div",
  model0: "select",
  model1: "select",
  model2: "select",
  modelsHint: "div",
  modelsLabel: "div",
  pageListLabel: "div",
  pageListOptIn: "textarea",
  pageListOptOut: "textarea",
  pageModeOptIn: "button",
  pageModeOptInDesc: "div",
  pageModeOptInTitle: "div",
  pageModeOptOut: "button",
  pageModeOptOutDesc: "div",
  pageModeOptOutTitle: "div",
  panelSubtitle: "div",
  panelTitle: "div",
  ratioEnLabel: "span",
  ratioEnValue: "div",
  ratioFill: "div",
  ratioJaLabel: "span",
  ratioJaValue: "div",
  ratioTitle: "div",
  save: "button",
  status: "div",
  translateButtons: "input",
  translateButtonsDesc: "div",
  translateButtonsTitle: "div",
} as const;

function getEl<K extends keyof typeof elTags>(id: K): ElOf<(typeof elTags)[K]> {
  const el = document.querySelector<ElOf<(typeof elTags)[K]>>(`#${id}`);
  if (el === null) {
    throw new Error(`Missing required element #${id}`);
  }
  return el;
}

export interface Elements {
  apiKeysSection: HTMLElement;
  customModel0: HTMLInputElement;
  customModel1: HTMLInputElement;
  customModel2: HTMLInputElement;
  enableDesc: HTMLElement;
  enableTitle: HTMLElement;
  enabled: HTMLInputElement;
  englishRatio: HTMLInputElement;
  langEn: HTMLButtonElement;
  langJa: HTMLButtonElement;
  minTextLength: HTMLInputElement;
  minTextLengthHint: HTMLElement;
  minTextLengthLabel: HTMLElement;
  mixLanguage: HTMLInputElement;
  mixLanguageDesc: HTMLElement;
  mixLanguageTitle: HTMLElement;
  model0: HTMLSelectElement;
  model1: HTMLSelectElement;
  model2: HTMLSelectElement;
  modelsHint: HTMLElement;
  modelsLabel: HTMLElement;
  pageListLabel: HTMLElement;
  pageListOptIn: HTMLTextAreaElement;
  pageListOptOut: HTMLTextAreaElement;
  pageModeOptIn: HTMLButtonElement;
  pageModeOptInDesc: HTMLElement;
  pageModeOptInTitle: HTMLElement;
  pageModeOptOut: HTMLButtonElement;
  pageModeOptOutDesc: HTMLElement;
  pageModeOptOutTitle: HTMLElement;
  panelSubtitle: HTMLElement;
  panelTitle: HTMLElement;
  ratioEnLabel: HTMLElement;
  ratioEnValue: HTMLElement;
  ratioFill: HTMLElement;
  ratioJaLabel: HTMLElement;
  ratioJaValue: HTMLElement;
  ratioLabel: HTMLElement | null;
  ratioTitle: HTMLElement;
  save: HTMLButtonElement;
  status: HTMLElement;
  translateButtons: HTMLInputElement;
  translateButtonsDesc: HTMLElement;
  translateButtonsTitle: HTMLElement;
}

export const elements: Elements = {
  apiKeysSection: getEl("apiKeysSection"),
  customModel0: getEl("customModel0"),
  customModel1: getEl("customModel1"),
  customModel2: getEl("customModel2"),
  enableDesc: getEl("enableDesc"),
  enableTitle: getEl("enableTitle"),
  enabled: getEl("enabled"),
  englishRatio: getEl("englishRatio"),
  langEn: getEl("langEn"),
  langJa: getEl("langJa"),
  minTextLength: getEl("minTextLength"),
  minTextLengthHint: getEl("minTextLengthHint"),
  minTextLengthLabel: getEl("minTextLengthLabel"),
  mixLanguage: getEl("mixLanguage"),
  mixLanguageDesc: getEl("mixLanguageDesc"),
  mixLanguageTitle: getEl("mixLanguageTitle"),
  model0: getEl("model0"),
  model1: getEl("model1"),
  model2: getEl("model2"),
  modelsHint: getEl("modelsHint"),
  modelsLabel: getEl("modelsLabel"),
  pageListLabel: getEl("pageListLabel"),
  pageListOptIn: getEl("pageListOptIn"),
  pageListOptOut: getEl("pageListOptOut"),
  pageModeOptIn: getEl("pageModeOptIn"),
  pageModeOptInDesc: getEl("pageModeOptInDesc"),
  pageModeOptInTitle: getEl("pageModeOptInTitle"),
  pageModeOptOut: getEl("pageModeOptOut"),
  pageModeOptOutDesc: getEl("pageModeOptOutDesc"),
  pageModeOptOutTitle: getEl("pageModeOptOutTitle"),
  panelSubtitle: getEl("panelSubtitle"),
  panelTitle: getEl("panelTitle"),
  ratioEnLabel: getEl("ratioEnLabel"),
  ratioEnValue: getEl("ratioEnValue"),
  ratioFill: getEl("ratioFill"),
  ratioJaLabel: getEl("ratioJaLabel"),
  ratioJaValue: getEl("ratioJaValue"),
  ratioLabel: document.querySelector<HTMLElement>("#ratioLabel"),
  ratioTitle: getEl("ratioTitle"),
  save: getEl("save"),
  status: getEl("status"),
  translateButtons: getEl("translateButtons"),
  translateButtonsDesc: getEl("translateButtonsDesc"),
  translateButtonsTitle: getEl("translateButtonsTitle"),
};
