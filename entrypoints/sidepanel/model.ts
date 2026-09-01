/* oxlint-disable max-lines, typescript/no-unnecessary-type-parameters, typescript/prefer-readonly-parameter-types */
import {
  CATALOG_PROVIDER_IDS,
  catalogProviderDisplayName,
  detectApiKeyProviderHint,
  isCatalogProviderId,
  isKnownOpenAIChatModelId,
  type ApiKeyProviderHint,
  type CatalogProviderId,
} from "@/utils/model-catalog";
import type { ModelCatalogResponse } from "@/utils/messages";
import type { ModelControl } from "./el";
import { elements } from "./el";
import { CUSTOM_MODEL_VALUE } from "./constants";
import { getTranslations } from "./translations";
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
  readonly providers: readonly ModelCatalogResponse["providers"][number][];
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

const OTHER_API_KEY_PROVIDER = "__other__";
const API_KEY_PROVIDER_OPTIONS: readonly Readonly<{
  key: string;
  label: string;
}>[] = [
  { key: "openrouter", label: "OpenRouter" },
  { key: "gpt", label: "OpenAI" },
  { key: "claude", label: "Anthropic" },
  { key: "gemini", label: "Google Gemini" },
  { key: "deepseek", label: "DeepSeek" },
  { key: "glm", label: "Z.AI" },
  { key: OTHER_API_KEY_PROVIDER, label: "Other / Custom" },
];

let catalogStatus: CatalogStatus = "idle";
let discoveredModels: readonly CatalogModel[] = [];
const catalogModelsByProvider = new Map<CatalogProviderId, readonly CatalogModel[]>();
const catalogStatusesByProvider = new Map<CatalogProviderId, ModelCatalogResponse["status"]>();
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

export function hasConfiguredCatalogProviderKey(
  apiKeys: Readonly<Record<string, string>>,
): boolean {
  return CATALOG_PROVIDER_IDS.some((provider) => (apiKeys[provider] ?? "").trim() !== "");
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

function catalogProviderForModel(modelId: string): CatalogProviderId | null {
  if (modelId.startsWith("openrouter/")) return "openrouter";
  if (isKnownOpenAIChatModelId(modelId)) return "gpt";
  if (modelId.startsWith("claude-")) return "claude";
  if (modelId.startsWith("gemini-")) return "gemini";
  return null;
}

function modelsForCatalogProvider(provider: CatalogProviderId): readonly CatalogModel[] {
  return discoveredModels.filter((model) => catalogProviderForModel(model.id) === provider);
}

export function populateModelSelects(): void {
  const t = getTranslations();
  const catalog = splitModelCatalog(modelsForCatalogProvider("openrouter"));
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
  catalog = splitModelCatalog(modelsForCatalogProvider("openrouter")),
): void {
  const t = getTranslations();
  control.menuOptions.replaceChildren();
  appendMenuOption(control, "", t.modelNone);
  if (catalog.latest.length > 0 || catalog.fixed.length > 0) {
    appendProviderLabel(control.menuOptions, catalogProviderDisplayName("openrouter"));
    appendMenuGroups(control, catalog.latest, t.modelCatalogOtherVendor);
  }
  CATALOG_PROVIDER_IDS.filter((provider) => provider !== "openrouter").forEach((provider) => {
    const models = modelsForCatalogProvider(provider);
    if (models.length === 0) return;
    appendProviderLabel(control.menuOptions, catalogProviderDisplayName(provider));
    models.forEach((model) => {
      appendMenuOption(control, model.id, modelCatalogLabel(model), control.menuOptions, true);
    });
  });
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

function appendProviderLabel(parent: HTMLElement, labelText: string): void {
  const label = document.createElement("span");
  label.className = "model-picker-provider-label";
  label.textContent = labelText;
  parent.append(label);
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
      return catalogProviderStatusText();
    case "not-configured":
      return t.modelCatalogNotConfigured;
    case "failed":
      return catalogProviderStatusText();
    case "idle":
      return "";
  }
  return "";
}

function catalogProviderStatusText(): string {
  const t = getTranslations();
  const statuses = CATALOG_PROVIDER_IDS.flatMap((provider) => {
    const status = catalogStatusesByProvider.get(provider);
    if (status === "ready") {
      return [
        t.modelCatalogProviderReady(
          catalogProviderDisplayName(provider),
          modelsForCatalogProvider(provider).length,
        ),
      ];
    }
    if (status === "failed") {
      return [t.modelCatalogProviderFailed(catalogProviderDisplayName(provider))];
    }
    return [];
  });
  return statuses.length > 0 ? statuses.join(" / ") : t.modelCatalogNotConfigured;
}

function aggregateCatalogStatus(): ModelCatalogResponse["status"] {
  const statuses = CATALOG_PROVIDER_IDS.map((provider) => catalogStatusesByProvider.get(provider));
  if (statuses.some((status) => status === "ready")) return "ready";
  if (statuses.some((status) => status === "failed")) return "failed";
  return "not-configured";
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
  result.providers.forEach((providerResult) => {
    catalogStatusesByProvider.set(providerResult.provider, providerResult.status);
    catalogModelsByProvider.set(
      providerResult.provider,
      providerResult.status === "ready" ? providerResult.models : [],
    );
  });
  catalogStatus = result.providers.length > 0 ? aggregateCatalogStatus() : result.status;
  discoveredModels = CATALOG_PROVIDER_IDS.flatMap(
    (provider) => catalogModelsByProvider.get(provider) ?? [],
  );
  if (result.providers.length > 0) populateModelSelects();
  renderCatalogControls();
}

function apiKeyKeysToRender(apiKeys: Readonly<Record<string, string>>): string[] {
  const knownKeys = API_KEY_PROVIDER_OPTIONS.map((option) => option.key).filter(
    (key) => key !== OTHER_API_KEY_PROVIDER,
  );
  return [
    ...knownKeys.filter((key) => (apiKeys[key] ?? "").trim() !== ""),
    ...Object.keys(apiKeys).filter((key) => !knownKeys.includes(key)),
  ];
}

export function renderApiKeyFields(
  _models: readonly string[],
  apiKeys: Readonly<Record<string, string>>,
  onChange: () => void,
): void {
  elements.apiKeysSection.innerHTML = "";
  apiKeyKeysToRender(apiKeys).forEach((key) => {
    elements.apiKeysSection.append(buildApiKeyRow(key, apiKeys, onChange));
  });
  elements.apiKeysSection.append(buildApiKeyAddRow(apiKeys, onChange));
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
  const t = getTranslations();
  const label = document.createElement("label");
  label.dataset.apiKeyLabel = apiKeyKey;
  label.textContent = `${name} ${t.apiKeyLabelSuffix}`;
  label.setAttribute("for", `apikey-${apiKeyKey}`);

  const wrap = document.createElement("div");
  wrap.className = "api-key-wrap";

  const input = document.createElement("input");
  input.type = "password";
  input.id = `apikey-${apiKeyKey}`;
  input.className = "input";
  input.dataset.prefix = apiKeyKey;
  input.placeholder = `${name} ${t.apiKeyLabelSuffix}`;
  input.value = apiKeys[apiKeyKey] ?? "";
  const hint = document.createElement("div");
  hint.className = "hint api-key-hint";
  hint.dataset.apiKeyHint = "true";
  updateApiKeyHint(input.value, hint, apiKeyKey);
  input.addEventListener("input", () => {
    updateApiKeyHint(input.value, hint, apiKeyKey);
    onChange();
  });

  const toggle = document.createElement("button");
  buildApiKeyToggle(input, toggle);

  wrap.append(input);
  wrap.append(toggle);
  row.append(label);
  row.append(wrap);
  row.append(hint);
  return row;
}

function buildApiKeyAddRow(
  apiKeys: Readonly<Record<string, string>>,
  onChange: () => void,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "api-key-row api-key-add-row";

  const label = document.createElement("label");
  label.className = "api-key-add-label";
  label.dataset.apiKeyAddLabel = "true";
  label.textContent = getTranslations().apiKeyAdd;

  const providerSelect = document.createElement("select");
  providerSelect.className = "select api-key-provider-select";
  providerSelect.dataset.apiKeyProvider = "true";
  appendApiKeyProviderOptions(providerSelect, apiKeys);

  const input = document.createElement("input");
  input.type = "password";
  input.className = "input";
  input.dataset.apiKeyPending = "true";
  input.placeholder = getTranslations().apiKeyInputPlaceholder;

  const wrap = document.createElement("div");
  wrap.className = "api-key-wrap";
  const toggle = buildApiKeyToggle(input);

  const hint = document.createElement("div");
  hint.className = "hint api-key-hint";
  hint.dataset.apiKeyHint = "true";
  const sync = (): void => {
    syncPendingApiKeyProvider(providerSelect, input, hint);
    onChange();
  };
  providerSelect.addEventListener("change", sync);
  input.addEventListener("input", sync);

  wrap.append(input);
  wrap.append(toggle);
  row.append(label);
  row.append(providerSelect);
  row.append(wrap);
  row.append(hint);
  syncPendingApiKeyProvider(providerSelect, input, hint);
  return row;
}

function buildApiKeyToggle(input: HTMLInputElement, target?: HTMLButtonElement): HTMLButtonElement {
  const toggle = target ?? document.createElement("button");
  toggle.type = "button";
  toggle.className = "api-key-toggle";
  toggle.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  toggle.addEventListener("click", () => {
    input.type = input.type === "password" ? "text" : "password";
  });
  return toggle;
}

function appendApiKeyProviderOptions(
  select: HTMLSelectElement,
  apiKeys: Readonly<Record<string, string>>,
): void {
  const t = getTranslations();
  appendOption(select, "", t.apiKeyProviderSelect);
  API_KEY_PROVIDER_OPTIONS.forEach((option) => {
    if (option.key !== OTHER_API_KEY_PROVIDER && (apiKeys[option.key] ?? "").trim() !== "") {
      return;
    }
    appendOption(
      select,
      option.key,
      option.key === OTHER_API_KEY_PROVIDER ? t.apiKeyProviderOther : option.label,
    );
  });
}

function syncPendingApiKeyProvider(
  providerSelect: HTMLSelectElement,
  input: HTMLInputElement,
  hint: HTMLElement,
): void {
  const providerKey = providerSelect.value;
  input.dataset.prefix =
    providerKey === "" || providerKey === OTHER_API_KEY_PROVIDER ? "" : providerKey;
  input.placeholder =
    providerKey === "" || providerKey === OTHER_API_KEY_PROVIDER
      ? getTranslations().apiKeyInputPlaceholder
      : `${providerName(providerKey)} ${getTranslations().apiKeyLabelSuffix}`;
  updateApiKeyHint(input.value, hint, providerKey);
}

function updateApiKeyHint(value: string, hint: HTMLElement, selectedProvider: string): void {
  const t = getTranslations();
  if (selectedProvider === OTHER_API_KEY_PROVIDER) {
    hint.textContent = t.apiKeyProviderOtherHint;
    return;
  }
  if (value.trim() === "") {
    hint.textContent = "";
    return;
  }
  const detected = detectApiKeyProviderHint(value);
  const detectedName = keyHintProviderName(detected);
  if (detected === "unknown") {
    hint.textContent = t.apiKeyHintUnknown;
    return;
  }
  const selectedHint = catalogProviderForKey(selectedProvider);
  if (selectedHint !== null && selectedHint !== detected) {
    hint.textContent = t.apiKeyHintMismatch(detectedName, providerName(selectedProvider));
    return;
  }
  hint.textContent = t.apiKeyHintDetected(detectedName);
}

function catalogProviderForKey(key: string): CatalogProviderId | null {
  return isCatalogProviderId(key) ? key : null;
}

function keyHintProviderName(hint: ApiKeyProviderHint): string {
  switch (hint) {
    case "openrouter":
      return catalogProviderDisplayName("openrouter");
    case "openai":
      return catalogProviderDisplayName("gpt");
    case "anthropic":
      return catalogProviderDisplayName("claude");
    case "google":
      return catalogProviderDisplayName("gemini");
    case "unknown":
      return getTranslations().apiKeyProviderOther;
  }
  return getTranslations().apiKeyProviderOther;
}

export function hasUnconfirmedApiKey(): boolean {
  return [
    ...elements.apiKeysSection.querySelectorAll<HTMLInputElement>("input[data-api-key-pending]"),
  ].some((input) => {
    if (input.value.trim() === "") return false;
    return input.dataset.prefix === "";
  });
}

export function getApiKeySaveValidationMessage(): string {
  const providerSelect = elements.apiKeysSection.querySelector<HTMLSelectElement>(
    "select[data-api-key-provider]",
  );
  return providerSelect?.value === OTHER_API_KEY_PROVIDER
    ? getTranslations().apiKeyProviderOtherHint
    : getTranslations().apiKeyProviderRequired;
}

export function refreshApiKeyFieldTranslations(): void {
  const t = getTranslations();
  elements.apiKeysSection
    .querySelectorAll<HTMLLabelElement>("label[data-api-key-label]")
    .forEach((label) => {
      const providerKey = label.dataset.apiKeyLabel ?? "";
      label.textContent = `${providerName(providerKey)} ${t.apiKeyLabelSuffix}`;
    });
  elements.apiKeysSection
    .querySelectorAll<HTMLInputElement>("input[data-prefix]")
    .forEach((input) => {
      const providerKey = input.dataset.prefix ?? "";
      input.placeholder = `${providerName(providerKey)} ${t.apiKeyLabelSuffix}`;
    });
  const addLabel = elements.apiKeysSection.querySelector<HTMLElement>("[data-api-key-add-label]");
  if (addLabel !== null) addLabel.textContent = t.apiKeyAdd;
  const providerSelect = elements.apiKeysSection.querySelector<HTMLSelectElement>(
    "select[data-api-key-provider]",
  );
  if (providerSelect !== null) {
    const selected = providerSelect.value;
    const firstOption = providerSelect.options.item(0);
    if (firstOption !== null) firstOption.textContent = t.apiKeyProviderSelect;
    const otherOption = [...providerSelect.options].find(
      (option) => option.value === OTHER_API_KEY_PROVIDER,
    );
    if (otherOption !== undefined) otherOption.textContent = t.apiKeyProviderOther;
    providerSelect.value = selected;
  }
  const pendingInput = elements.apiKeysSection.querySelector<HTMLInputElement>(
    "input[data-api-key-pending]",
  );
  const pendingHint = elements.apiKeysSection.querySelector<HTMLElement>(
    "input[data-api-key-pending] ~ .api-key-hint",
  );
  if (pendingInput !== null && pendingHint !== null && providerSelect !== null) {
    syncPendingApiKeyProvider(providerSelect, pendingInput, pendingHint);
  }
}

export function collectApiKeys(): Record<string, string> {
  const keys: Record<string, string> = {};
  elements.apiKeysSection
    .querySelectorAll<HTMLInputElement>("input[data-prefix]")
    .forEach((input: HTMLInputElement) => {
      const value = input.value.trim();
      const prefix = input.dataset.prefix ?? "";
      if (value !== "" && prefix !== "") {
        keys[prefix] = value;
      }
    });
  return keys;
}
