/**
 * Config shape and merge logic.
 *
 * Defaults were previously duplicated between `config.js` (used by the
 * background service worker, side panel and options) and a local copy inside
 * the content script with *different* values. The legacy content script was
 * not an ES module and could not import config.js, so the two had to be kept
 * in sync by hand; that is why the defaults live in one place now. The content
 * script always receives config from the background after startup, so local
 * defaults were effectively dead anyway. This is the single source of truth.
 */
import type { Language } from "./messages";
import { DEFAULT_LOCAL_ENDPOINT, mergeLocalEndpoint } from "./local-endpoint";
import type { LocalEndpointConfig } from "./local-endpoint";

export interface Config {
  autoTranslate: boolean;
  enabled: boolean;
  models: string[];
  apiKeys: Record<string, string>;
  localEndpoint: LocalEndpointConfig;
  translationMode: "model-chain" | "plamo" | "local-model";
  localModelId: string;
  pageListInclude: string;
  pageListExclude: string;
  pageListDefaultMigrated: boolean;
  mixLanguage: boolean;
  englishRatio: number;
  translateButtons: boolean;
  minTextLength: number;
  outputRatio: number;
  ttsVoice: string;
  uiLanguage?: Language;
}

export const DEFAULT_CONFIG: Config = {
  apiKeys: {},
  autoTranslate: true,
  enabled: true,
  englishRatio: 30,
  minTextLength: 5,
  mixLanguage: true,
  localEndpoint: { ...DEFAULT_LOCAL_ENDPOINT },
  translationMode: "model-chain",
  localModelId: "default_model",
  models: [],
  outputRatio: 20,
  pageListExclude: "",
  pageListInclude: "",
  pageListDefaultMigrated: true,
  translateButtons: false,
  ttsVoice: "nova",
};

/**
 * Merge a raw (partially unknown) stored config onto the defaults, stripping
 * legacy fields. Guarantees a well-formed `Config` even if the stored value is
 * corrupt or from an older version.
 *
 * Legacy positional keys (`providerId`, `apiKey`, `providerOptions`) are
 * removed on every merge so they never leak back into storage.
 */
/** Readonly view of the partial config merge input, suitable as a parameter. */
type MergeInput = Readonly<Omit<Partial<Config>, "models" | "apiKeys" | "localEndpoint">> & {
  models?: readonly string[];
  apiKeys?: Readonly<Record<string, string>>;
  localEndpoint?: Readonly<Partial<LocalEndpointConfig>>;
  plamoModel?: unknown;
};

export function mergeConfig(raw: Readonly<MergeInput> | null | undefined): Config {
  const safe: MergeInput = raw ?? {};
  const models: readonly string[] = Array.isArray(safe.models)
    ? safe.models
    : DEFAULT_CONFIG.models;
  const merged: Config = {
    ...DEFAULT_CONFIG,
    ...safe,
    apiKeys: { ...DEFAULT_CONFIG.apiKeys, ...safe.apiKeys },
    localEndpoint: mergeLocalEndpoint(safe.localEndpoint),
    models: [...models],
    localModelId:
      typeof safe.localModelId === "string" && safe.localModelId.trim() !== ""
        ? safe.localModelId
        : typeof safe.plamoModel === "string" && safe.plamoModel.trim() !== ""
          ? safe.plamoModel
          : DEFAULT_CONFIG.localModelId,
    translationMode:
      safe.translationMode === "plamo" || safe.translationMode === "local-model"
        ? safe.translationMode
        : "model-chain",
  };
  if (safe.pageListDefaultMigrated !== true && safe.pageListInclude === "https://*") {
    merged.pageListInclude = "";
  }
  merged.pageListDefaultMigrated = true;
  if ("providerId" in merged) {
    delete merged.providerId;
  }
  if ("apiKey" in merged) {
    delete merged.apiKey;
  }
  if ("providerOptions" in merged) {
    delete merged.providerOptions;
  }
  if ("plamoModel" in merged) {
    delete merged.plamoModel;
  }
  return merged;
}
