import { browser } from "wxt/browser";
import { mergeConfig } from "@/utils/config";
import type { Config } from "@/utils/config";
import type { MlgMessage } from "@/utils/messages";
import { STORAGE_KEY } from "@/utils/keys";
import { STATE, isPageAllowed, loadConfig, updatePageMatchers } from "./state";
import { start, stop, watchUrlChanges } from "./observer";
import { refreshDisplay } from "./root";
import { buildNormaKey } from "./blocks";

function isConfigRecord(value: unknown): value is Config {
  return typeof value === "object" && value !== null;
}

export async function init(): Promise<void> {
  STATE.config = await loadConfig();
  updatePageMatchers();
  if (STATE.config.enabled && isPageAllowed()) {
    start();
  }
  browser.runtime.onMessage.addListener((message: MlgMessage) => {
    if (message.type === "mlg:normaDone" && message.payload?.textKey) {
      const blocks = document.querySelectorAll<HTMLElement>("[data-mlg-output='1']");
      blocks.forEach((block) => {
        if (buildNormaKey((block.textContent || "").trim()) === message.payload.textKey) {
          delete block.dataset.mlgOutput;
        }
      });
    }
  });
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) {
      return;
    }
    const raw: unknown = changes[STORAGE_KEY].newValue;
    STATE.config = mergeConfig(isConfigRecord(raw) ? raw : undefined);
    updatePageMatchers();
    const shouldTranslate = STATE.config.enabled && isPageAllowed();
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
