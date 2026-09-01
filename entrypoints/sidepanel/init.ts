import { elements } from "./el";
import { setCurrentLanguage } from "./translations";
import { loadLanguage, setLanguage } from "./language";
import { loadConfig, saveConfig, updateDirtyState } from "./config";
import { initSettingsModule } from "./init-settings";
import { initOutputTab } from "./init-output";
import { initMessages, initPendingExplanation } from "./init-messages";
import { initMyExamples, initVocab } from "./init-vocab";
import {
  applyModelCatalogResult,
  collectApiKeys,
  hasConfiguredCatalogProviderKey,
  getSelectedModels,
  renderApiKeyFields,
  setModelCatalogLoading,
} from "./model";
import { refreshModelCatalogRpc } from "./rpc";

type CatalogProviderId = NonNullable<Parameters<typeof refreshModelCatalogRpc>[0]>[number];
let latestModelCatalogRequest = 0;

async function refreshModelCatalog(
  saveFirst: boolean,
  requestedProviders?: readonly CatalogProviderId[],
): Promise<void> {
  let requestGeneration: number | null = null;
  try {
    if (saveFirst) {
      const saveResult = await saveConfig();
      if (!saveResult.saved) return;
    }
    requestGeneration = ++latestModelCatalogRequest;
    setModelCatalogLoading();
    const result = await refreshModelCatalogRpc(requestedProviders);
    if (requestGeneration !== latestModelCatalogRequest) return;
    applyModelCatalogResult(result ?? { models: [], providers: [], status: "failed" });
  } catch {
    if (requestGeneration !== null && requestGeneration !== latestModelCatalogRequest) return;
    applyModelCatalogResult({ models: [], providers: [], status: "failed" });
  }
}

async function saveAndRefreshModelCatalog(): Promise<void> {
  try {
    const saveResult = await saveConfig();
    if (!saveResult.saved) return;
    renderApiKeyFields(getSelectedModels(), collectApiKeys(), updateDirtyState);
    if (saveResult.changedCatalogProviders.length > 0) {
      await refreshModelCatalog(false, saveResult.changedCatalogProviders);
    }
  } catch {
    applyModelCatalogResult({ models: [], providers: [], status: "failed" });
  }
}

function initSaveAndLang(): void {
  elements.save.addEventListener("click", () => {
    void saveAndRefreshModelCatalog();
  });
  elements.modelCatalogRefresh.addEventListener("click", () => {
    void refreshModelCatalog(true);
  });
  elements.langJa.addEventListener("click", () => {
    void setLanguage("ja");
  });
  elements.langEn.addEventListener("click", () => {
    void setLanguage("en");
  });
}

export async function init(): Promise<void> {
  const [config, lang] = await Promise.all([loadConfig(), loadLanguage()]);
  setCurrentLanguage(lang);
  initSettingsModule(config);
  initOutputTab();
  initMessages();
  initVocab();
  initMyExamples();
  initSaveAndLang();
  await initPendingExplanation();
  if (hasConfiguredCatalogProviderKey(config.apiKeys)) {
    void refreshModelCatalog(false);
  }
}
