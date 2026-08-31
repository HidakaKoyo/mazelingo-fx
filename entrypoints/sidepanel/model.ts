import { LLM_REGISTRY } from "@/utils/llm";
import type { ModelCatalogResponse } from "@/utils/messages";
import type { ModelControl } from "./el";
import { elements } from "./el";
import { CUSTOM_MODEL_VALUE } from "./constants";
import { getTranslations } from "./translations";
import { getProviderPrefix } from "./util";

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
    { input: elements.customModel0, select: elements.model0 },
    { input: elements.customModel1, select: elements.model1 },
    { input: elements.customModel2, select: elements.model2 },
  ];
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

function modelLabel(model: Readonly<CatalogModel>): string {
  const providerModelId = model.id.replace(/^openrouter\//u, "");
  return `${model.name} — ${providerModelId}`;
}

export function populateModelSelects(): void {
  const t = getTranslations();
  for (const control of getModelControls()) {
    const select = control.select;
    const current = getModelValue(control);
    select.innerHTML = "";
    appendOption(select, "", t.modelNone);
    discoveredModels.forEach((model) => {
      appendOption(select, model.id, modelLabel(model));
    });
    appendOption(select, CUSTOM_MODEL_VALUE, t.customModel);
    setModelControlValue(control, current);
  }
  renderCatalogControls();
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
