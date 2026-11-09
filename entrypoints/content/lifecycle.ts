import { browser } from "wxt/browser";
import { mergeConfig } from "@/utils/config";
import type { Config } from "@/utils/config";
import type { MlgMessage } from "@/utils/messages";
import { STORAGE_KEY } from "@/utils/keys";
import { STATE, loadConfig, shouldTranslatePage, updatePageMatchers } from "./state";
import { start, stop, watchUrlChanges } from "./observer";
import { refreshDisplay } from "./root";
import { buildNormaKey } from "./blocks";
import { applySiteAutoTranslationChange, togglePageTranslation } from "./page-actions";

function isConfigRecord(value: unknown): value is Config {
  return typeof value === "object" && value !== null;
}

export async function init(): Promise<void> {
  STATE.config = await loadConfig();
  updatePageMatchers();
  if (shouldTranslatePage()) {
    start();
  }
  browser.runtime.onMessage.addListener(
    (message: MlgMessage, _sender: unknown, sendResponse: (response?: unknown) => void) => {
      if (message.type === "mlg:togglePageTranslation") {
        togglePageTranslation();
        return;
      }
      if (message.type === "mlg:getPageTranslationState") {
        sendResponse({ active: STATE.started });
        return;
      }
      if (message.type === "mlg:siteAutoTranslationChanged") {
        applySiteAutoTranslationChange(message.payload.enabled, message.payload.status);
        return;
      }
      if (message.type === "mlg:normaDone" && message.payload?.textKey) {
        const blocks = document.querySelectorAll<HTMLElement>("[data-mlg-output='1']");
        blocks.forEach((block) => {
          if (buildNormaKey((block.textContent || "").trim()) === message.payload.textKey) {
            delete block.dataset.mlgOutput;
          }
        });
      }
    },
  );
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) {
      return;
    }
    const raw: unknown = changes[STORAGE_KEY].newValue;
    STATE.config = mergeConfig(isConfigRecord(raw) ? raw : undefined);
    updatePageMatchers();
    const shouldTranslate = shouldTranslatePage();
    if (shouldTranslate && !STATE.started) {
      start();
    } else if (!shouldTranslate && STATE.started) {
      stop();
    } else if (shouldTranslate) {
      refreshDisplay();
    }
  });
  watchUrlChanges();
}
