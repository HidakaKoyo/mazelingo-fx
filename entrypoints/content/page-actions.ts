import { start, stop } from "./observer";
import { showStatus } from "./status";
import { STATE } from "./state";
import { refreshDisplay } from "./root";

const DISABLED_MESSAGE = "翻訳が無効になっています。設定でオンにしてください";

function ensureEnabled(): boolean {
  if (STATE.config.enabled) return true;
  showStatus(DISABLED_MESSAGE);
  return false;
}

export function togglePageTranslation(): void {
  if (!ensureEnabled()) return;
  if (STATE.started) {
    STATE.pageTranslationOverride = "off";
    stop();
    showStatus("原文に戻しました");
    return;
  }
  STATE.pageTranslationOverride = "on";
  start();
  refreshDisplay();
  showStatus("このページを翻訳しています");
}

export function applySiteAutoTranslationChange(
  enabled: boolean,
  status: "changed" | "broader-match",
): void {
  if (!ensureEnabled()) return;
  if (status === "broader-match") {
    showStatus("より広い設定に含まれているため、このサイトだけは外せません");
    return;
  }
  if (enabled && !STATE.config.autoTranslate) return;
  STATE.pageTranslationOverride = null;
  if (enabled) {
    if (!STATE.started) start();
    refreshDisplay();
    showStatus("このサイトを自動で翻訳します");
  } else {
    if (STATE.started) stop();
    showStatus("自動翻訳から外しました");
  }
}
