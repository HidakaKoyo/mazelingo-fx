import type { Config } from "@/utils/config";
import { elements } from "./el";
import { getTranslations } from "./translations";
import type { DeepReadonly } from "./util";
import { connectionSummaries } from "./connection-settings-state";

function getEl<T extends keyof HTMLElementTagNameMap>(
  id: string,
  tag: T,
): HTMLElementTagNameMap[T] {
  const element = document.querySelector<HTMLElementTagNameMap[T]>(`#${CSS.escape(id)}`);
  if (element === null || element.tagName.toLowerCase() !== tag) throw new Error(`Missing ${id}`);
  return element;
}

const connectionElements = {
  api: getEl("apiConnection", "details"),
  apiStatus: getEl("apiConnectionStatus", "span"),
  local: getEl("localConnection", "details"),
  localApiKeyStatus: getEl("localApiKeyStatus", "span"),
  localStatus: getEl("localConnectionStatus", "span"),
  localUrlRequired: getEl("localUrlRequired", "div"),
  plamoHint: getEl("plamoModeHint", "div"),
};

export function selectedTranslationMode(): Config["translationMode"] {
  if (elements.translationUse.value === "api") return "model-chain";
  return elements.localMode.value === "local-model" ? "local-model" : "plamo";
}

export function refreshConnectionSettings(switchGroups = false): void {
  const t = getTranslations();
  const mode = selectedTranslationMode();
  const usesLocal = mode !== "model-chain";
  const hasModels = elements.model0.value !== "";
  const hasLocalUrl = elements.localBaseUrl.value.trim() !== "";

  connectionElements.plamoHint.hidden = mode !== "plamo";
  connectionElements.localUrlRequired.hidden = !usesLocal || hasLocalUrl;
  if (switchGroups) {
    connectionElements.api.open = !usesLocal;
    connectionElements.local.open = usesLocal;
  }
  const summaries = connectionSummaries(
    {
      connectedProviderCount: elements.apiKeysSection.querySelectorAll("[data-api-key-connected]")
        .length,
      customServerUrl: elements.localBaseUrl.value,
      hasModelChain: hasModels,
      translationMode: mode,
    },
    t,
  );
  connectionElements.apiStatus.textContent = summaries.provider;
  connectionElements.localStatus.textContent = summaries.customServer;
  connectionElements.localApiKeyStatus.textContent =
    elements.localApiKey.value.trim() === "" ? t.apiKeyNotSet : t.apiKeySet;
}

export function initConnectionSettings(config: DeepReadonly<Config>, onChange: () => void): void {
  // 画面上の「カスタムサーバー」は既存設定の localEndpoint と localModelId に対応する。
  const usesLocal = config.translationMode !== "model-chain";
  elements.translationUse.value = usesLocal ? "local" : "api";
  elements.localMode.value = config.translationMode === "local-model" ? "local-model" : "plamo";
  elements.localBaseUrl.value = config.localEndpoint.baseUrl;
  elements.localApiKey.value = config.localEndpoint.apiKey;
  elements.localModelId.value = config.localModelId;
  refreshConnectionSettings(true);

  elements.translationUse.addEventListener("change", () => {
    refreshConnectionSettings(true);
    onChange();
  });
  elements.localMode.addEventListener("change", () => {
    refreshConnectionSettings();
    onChange();
  });
  elements.localBaseUrl.addEventListener("input", () => {
    refreshConnectionSettings();
    onChange();
  });
  elements.localApiKey.addEventListener("input", () => {
    refreshConnectionSettings();
    onChange();
  });
  elements.localModelId.addEventListener("input", onChange);
}
