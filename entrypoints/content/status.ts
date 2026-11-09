let statusElement: HTMLDivElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

export function showStatus(message: string): void {
  if (statusElement?.isConnected !== true) {
    statusElement = document.createElement("div");
    statusElement.dataset.mlgStatus = "1";
    statusElement.setAttribute("aria-live", "polite");
    statusElement.style.cssText =
      "position:fixed;right:16px;bottom:16px;z-index:2147483647;padding:8px 12px;border-radius:8px;background:#1f2937;color:#fff;font:13px/1.4 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.2)";
    document.body.append(statusElement);
  }
  statusElement.hidden = false;
  statusElement.textContent = message;
  if (hideTimer !== null) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (statusElement) statusElement.hidden = true;
  }, 2500);
}
