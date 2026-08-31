import { elements } from "./el";
import { setCurrentLanguage } from "./translations";
import { loadLanguage, setLanguage } from "./language";
import { loadConfig, saveConfig } from "./config";
import { initSettingsModule } from "./init-settings";
import { initOutputTab } from "./init-output";
import { initMessages, initPendingExplanation } from "./init-messages";
import { initMyExamples, initVocab } from "./init-vocab";
import { applyModelCatalogResult, setModelCatalogLoading } from "./model";
import { refreshModelCatalogRpc } from "./rpc";

async function refreshModelCatalog(saveFirst: boolean): Promise<void> {
  setModelCatalogLoading();
  try {
    if (saveFirst) {
      await saveConfig();
    }
    const result = await refreshModelCatalogRpc();
    applyModelCatalogResult(result ?? { models: [], status: "failed" });
  } catch {
    applyModelCatalogResult({ models: [], status: "failed" });
  }
}

function initSaveAndLang(): void {
  elements.save.addEventListener("click", () => {
    void saveConfig();
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
  if ((config.apiKeys.openrouter ?? "").trim() !== "") {
    void refreshModelCatalog(false);
  }
}
