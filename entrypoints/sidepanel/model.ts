import { LLM_REGISTRY } from "@/utils/llm";
import type { ModelControl } from "./el";
import { elements } from "./el";
import { CUSTOM_MODEL_VALUE, MODEL_OPTIONS, type ModelOption } from "./constants";
import { getCurrentLanguage, getTranslations } from "./translations";
import { getProviderPrefix, type DeepReadonly } from "./util";

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
  return MODEL_OPTIONS.some((opt: DeepReadonly<ModelOption>) =>
    typeof opt === "string" ? opt === modelName : opt.value === modelName,
  );
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

export function populateModelSelects(): void {
  for (const control of getModelControls()) {
    const sel = control.select;
    const current = getModelValue(control);
    sel.innerHTML = "";
    for (const opt of MODEL_OPTIONS) {
      const o = document.createElement("option");
      if (typeof opt === "string") {
        o.value = opt;
        o.textContent = opt;
      } else {
        o.value = opt.value;
        o.textContent = opt.label[getCurrentLanguage()] ?? opt.label.ja;
      }
      sel.append(o);
    }
    setModelControlValue(control, current);
  }
}

export function renderApiKeyFields(
  models: readonly string[],
  apiKeys: Readonly<Record<string, string>>,
  onChange: () => void,
): void {
  elements.apiKeysSection.innerHTML = "";
  const prefixes: string[] = [];
  const seen = new Set<string>();
  models.forEach((model) => {
    const prefix = getProviderPrefix(model);
    const apiKeyKey = prefix === null ? null : (LLM_REGISTRY[prefix]?.apiKeyKey ?? prefix);
    if (apiKeyKey === null || seen.has(apiKeyKey)) {
      return;
    }
    seen.add(apiKeyKey);
    prefixes.push(apiKeyKey);
  });
  prefixes.forEach((prefix) => {
    elements.apiKeysSection.append(buildApiKeyRow(prefix, apiKeys, onChange));
  });
}

function buildApiKeyRow(
  prefix: string,
  apiKeys: Readonly<Record<string, string>>,
  onChange: () => void,
): HTMLElement {
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
  input.value = apiKeys[prefix] ?? "";
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
