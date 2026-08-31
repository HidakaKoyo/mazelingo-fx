import { defineBackground } from "wxt/utils/define-background";
import { browser } from "wxt/browser";
import { DEFAULT_CONFIG } from "@/utils/config";
import { openToolbarPanel } from "@/utils/browser-actions";
import { STORAGE_KEY } from "@/utils/keys";
import { handleMessage } from "./handlers";
import type { Sender } from "./handlers";

async function initializeConfigIfNeeded(): Promise<void> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  if (result[STORAGE_KEY] === undefined || result[STORAGE_KEY] === null) {
    await browser.storage.local.set({ [STORAGE_KEY]: DEFAULT_CONFIG });
  }
}

type MessageListener = (
  message: unknown,
  sender: Sender,
  sendResponse: (response?: unknown) => void,
) => boolean;

const messageListener: MessageListener = (message, sender, sendResponse) =>
  handleMessage(message, sender, sendResponse);

export function handleCommand(command: string, tab?: Readonly<{ id?: number }>): void {
  if (command !== "reader-translate-page" || tab?.id === undefined) {
    return;
  }
  void browser.tabs.sendMessage(tab.id, { type: "mlg:readerRun" }).catch(() => {});
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    messageListener as (
      message: unknown,
      sender: Sender,
      sendResponse: (response?: unknown) => void,
    ) => void,
  );
  browser.runtime.onInstalled.addListener(() => {
    void initializeConfigIfNeeded();
  });
  browser.action.onClicked.addListener((tab: Readonly<{ id?: number }>) => {
    void openToolbarPanel(tab.id).catch(() => {});
  });
  browser.commands.onCommand.addListener((command, tab) => {
    handleCommand(command, tab);
  });
});
