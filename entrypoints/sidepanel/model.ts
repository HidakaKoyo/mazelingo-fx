/* oxlint-disable max-lines, typescript/no-unnecessary-type-parameters, typescript/prefer-readonly-parameter-types */
import { LLM_REGISTRY } from "@/utils/llm";
import type { ModelCatalogResponse } from "@/utils/messages";
import type { ModelControl } from "./el";
import { elements } from "./el";
import { CUSTOM_MODEL_VALUE } from "./constants";
import { getTranslations } from "./translations";
import { getProviderPrefix } from "./util";
import {
  groupModelsByVendor,
  modelCatalogLabel,
  openRouterVendorLabel,
  splitModelCatalog,
} from "./model-groups";

type CatalogModel = Readonly<ModelCatalogResponse["models"][number]>;
type ReadonlyModelCatalogResponse = {
  readonly models: readonly CatalogModel[];
  readonly status: ModelCatalogResponse["status"];
};

type CatalogStatus = "idle" | "loading" | ModelCatalogResponse["status"];

const PROVIDER_NAMES: Readonly<Record<string, string>> = {
  claude: "Anthropic",
  deepseek: "DeepSeek",
  gemini: "Google Gemini",
  glm: "Z.AI",
  gpt: "OpenAI",
  openrouter: "OpenRouter",
};

let catalogStatus: CatalogStatus = "idle";
let discoveredModels: readonly CatalogModel[] = [];
export function getModelControls(): ModelControl[] {
  return [
    modelControl(0, elements.customModel0, elements.model0),
    modelControl(1, elements.customModel1, elements.model1),
    modelControl(2, elements.customModel2, elements.model2),
  ];
}

function modelControl(
  index: number,
  input: HTMLInputElement,
  select: HTMLSelectElement,
): ModelControl {
  return {
    input,
    menu: requiredElement<HTMLDetailsElement>(`#modelMenu${index}`),
    menuOptions: requiredElement<HTMLDivElement>(`#modelMenuOptions${index}`),
    menuTrigger: requiredElement<HTMLSpanElement>(`#modelMenuTrigger${index}`),
    select,
  };
}

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`Missing required element: ${selector}`);
  return element;
}
export function getModelValue(control: Readonly<ModelControl>): string {
  return control.select.value === CUSTOM_MODEL_VALUE
    ? control.input.value.trim()
    : control.select.value;
}
export function getSelectedModels(): string[] {
  return getModelControls()
    .map((control) => getModelValue(control))
    .filter((value) => value !== "");
}
function isListedModel(modelName: string): boolean {
  return discoveredModels.some((model) => model.id === modelName);
}

export function syncCustomModelControl(control: Readonly<ModelControl>): void {
  const isCustom = control.select.value === CUSTOM_MODEL_VALUE;
  control.input.hidden = !isCustom;
  control.input.placeholder = getTranslations().customModelPlaceholder;
  updateModelPickerTrigger(control);
}

export function setModelControlValue(control: Readonly<ModelControl>, modelName: string): void {
  if (modelName === "" || isListedModel(modelName)) {
    control.select.value = modelName;
    control.input.value = "";
  } else {
    control.select.value = CUSTOM_MODEL_VALUE;
    control.input.value = modelName;
  }
  syncCustomModelControl(control);
}

export function setModelValues(models: readonly string[]): void {
  getModelControls().forEach((control, index) => {
    setModelControlValue(control, models[index] ?? "");
  });
}

function appendOption(select: HTMLSelectElement, value: string, label: string): void {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  select.append(option);
}

function vendorLabel(vendor: string): string {
  return openRouterVendorLabel(vendor);
}

export function populateModelSelects(): void {
  const t = getTranslations();
  const catalog = splitModelCatalog(discoveredModels);
  for (const control of getModelControls()) {
    const select = control.select;
    const current = getModelValue(control);
    select.innerHTML = "";
    appendOption(select, "", t.modelNone);
    discoveredModels.forEach((model) => {
      appendOption(select, model.id, modelCatalogLabel(model));
    });
    appendOption(select, CUSTOM_MODEL_VALUE, t.customModel);
    setModelControlValue(control, current);
    renderModelPicker(control, catalog);
  }
  renderCatalogControls();
}

function renderModelPicker(
  control: Readonly<ModelControl>,
  catalog = splitModelCatalog(discoveredModels),
): void {
  const t = getTranslations();
  control.menuOptions.replaceChildren();
  appendMenuOption(control, "", t.modelNone);
  appendMenuGroups(control, catalog.latest, t.modelCatalogOtherVendor);
  appendMenuOption(control, CUSTOM_MODEL_VALUE, t.customModel);

  if (catalog.fixed.length > 0) {
    const fixed = document.createElement("details");
    fixed.className = "model-picker-fixed";
    const summary = document.createElement("summary");
    summary.textContent = t.modelCatalogFixedModels;
    fixed.append(summary);
    appendMenuGroups(control, catalog.fixed, t.modelCatalogOtherVendor, fixed);
    control.menuOptions.append(fixed);
  }

  updateModelPickerTrigger(control);
}

function appendMenuGroups(
  control: Readonly<ModelControl>,
  models: readonly CatalogModel[],
  otherVendorLabel: string,
  parent: HTMLElement = control.menuOptions,
): void {
  groupModelsByVendor(models).forEach((group) => {
    const label = document.createElement("span");
    label.className = "model-picker-group-label";
    label.textContent = group.vendor === null ? otherVendorLabel : vendorLabel(group.vendor);
    parent.append(label);
    group.models.forEach((model) => {
      appendMenuOption(control, model.id, modelCatalogLabel(model), parent, true);
    });
  });
}

function appendMenuOption(
  control: Readonly<ModelControl>,
  value: string,
  label: string,
  parent: HTMLElement = control.menuOptions,
  isModelOption = false,
): void {
  const option = document.createElement("button");
  option.type = "button";
  option.className = "model-picker-option";
  if (isModelOption) option.classList.add("model-picker-model-option");
  option.textContent = label;
  option.setAttribute("aria-current", String(control.select.value === value));
  option.addEventListener("click", () => {
    control.select.value = value;
    control.select.dispatchEvent(new Event("change", { bubbles: true }));
    control.menu.open = false;
    renderModelPicker(control);
  });
  parent.append(option);
}

export function updateModelPickerTrigger(control: Readonly<ModelControl>): void {
  const value = getModelValue(control);
  if (value === "") {
    control.menuTrigger.textContent = getTranslations().modelNone;
    return;
  }
  if (control.select.value === CUSTOM_MODEL_VALUE) {
    control.menuTrigger.textContent = value || getTranslations().customModel;
    return;
  }
  const selected = discoveredModels.find((model) => model.id === value);
  control.menuTrigger.textContent = selected === undefined ? value : modelCatalogLabel(selected);
}

function catalogStatusText(): string {
  const t = getTranslations();
  switch (catalogStatus) {
    case "loading":
      return t.modelCatalogLoading;
    case "ready":
      return t.modelCatalogReady(discoveredModels.length);
    case "not-configured":
      return t.modelCatalogNotConfigured;
    case "failed":
      return t.modelCatalogFailed;
    case "idle":
      return "";
  }
  return "";
}

function renderCatalogControls(): void {
  const t = getTranslations();
  elements.modelCatalogRefresh.disabled = catalogStatus === "loading";
  elements.modelCatalogRefresh.textContent =
    catalogStatus === "loading" ? t.modelCatalogLoading : t.modelCatalogRefresh;
  elements.modelCatalogStatus.textContent = catalogStatusText();
}

export function setModelCatalogLoading(): void {
  catalogStatus = "loading";
  renderCatalogControls();
}

export function applyModelCatalogResult(result: ReadonlyModelCatalogResponse): void {
  catalogStatus = result.status;
  if (result.status === "ready") {
    discoveredModels = result.models;
    populateModelSelects();
    return;
  }
  if (result.status === "not-configured") {
    discoveredModels = [];
    populateModelSelects();
    return;
  }
  renderCatalogControls();
}

function apiKeyKeyForModel(model: string): string | null {
  const prefix = getProviderPrefix(model);
  if (prefix === null) {
    return null;
  }
  return LLM_REGISTRY[prefix]?.apiKeyKey ?? prefix;
}

function apiKeyKeysToRender(
  models: readonly string[],
  apiKeys: Readonly<Record<string, string>>,
): string[] {
  const keys = ["openrouter"];
  const add = (key: string | null): void => {
    if (key !== null && !keys.includes(key)) {
      keys.push(key);
    }
  };
  models.forEach((model) => {
    add(apiKeyKeyForModel(model));
  });
  Object.keys(apiKeys).forEach((key) => {
    add(key);
  });
  return keys;
}

export function renderApiKeyFields(
  models: readonly string[],
  apiKeys: Readonly<Record<string, string>>,
  onChange: () => void,
): void {
  elements.apiKeysSection.innerHTML = "";
  apiKeyKeysToRender(models, apiKeys).forEach((key) => {
    elements.apiKeysSection.append(buildApiKeyRow(key, apiKeys, onChange));
  });
}

function providerName(apiKeyKey: string): string {
  return PROVIDER_NAMES[apiKeyKey] ?? apiKeyKey;
}

function buildApiKeyRow(
  apiKeyKey: string,
  apiKeys: Readonly<Record<string, string>>,
  onChange: () => void,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "api-key-row";

  const name = providerName(apiKeyKey);
  const label = document.createElement("label");
  label.textContent = `${name} API key`;
  label.setAttribute("for", `apikey-${apiKeyKey}`);

  const wrap = document.createElement("div");
  wrap.className = "api-key-wrap";

  const input = document.createElement("input");
  input.type = "password";
  input.id = `apikey-${apiKeyKey}`;
  input.className = "input";
  input.dataset.prefix = apiKeyKey;
  input.placeholder = `${name} API key`;
  input.value = apiKeys[apiKeyKey] ?? "";
  input.addEventListener("input", onChange);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "api-key-toggle";
  toggle.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  toggle.addEventListener("click", () => {
    input.type = input.type === "password" ? "text" : "password";
  });

  wrap.append(input);
  wrap.append(toggle);
  row.append(label);
  row.append(wrap);
  return row;
}

export function collectApiKeys(): Record<string, string> {
  const keys: Record<string, string> = {};
  elements.apiKeysSection
    .querySelectorAll<HTMLInputElement>("input[data-prefix]")
    .forEach((input: HTMLInputElement) => {
      const value = input.value.trim();
      if (value !== "") {
        keys[input.dataset.prefix ?? ""] = value;
      }
    });
  return keys;
}
