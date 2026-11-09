import { defineBackground } from "wxt/utils/define-background";
import { browser } from "wxt/browser";
import { DEFAULT_CONFIG, mergeConfig } from "@/utils/config";
import { getContextMenuApi, openToolbarPanel } from "@/utils/browser-actions";
import { STORAGE_KEY } from "@/utils/keys";
import { handleMessage } from "./handlers";
import type { Sender } from "./handlers";
import {
  setupContextMenus,
  togglePageForTab,
  toggleSiteForTab,
  TOGGLE_SITE_COMMAND,
  TRANSLATE_PAGE_COMMAND,
} from "./page-actions";

export async function initializeConfigIfNeeded(): Promise<void> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY];
  if (stored === undefined || stored === null) {
    await browser.storage.local.set({ [STORAGE_KEY]: DEFAULT_CONFIG });
  } else if (typeof stored === "object" && !("pageListDefaultMigrated" in stored)) {
    await browser.storage.local.set({ [STORAGE_KEY]: mergeConfig(stored) });
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
  if (command === TRANSLATE_PAGE_COMMAND) togglePageForTab(tab);
  if (command === TOGGLE_SITE_COMMAND) void toggleSiteForTab(tab);
}

export default defineBackground(() => {
  void initializeConfigIfNeeded();
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
  const menu = getContextMenuApi();
  if (menu) void setupContextMenus(menu);
});
