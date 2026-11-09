import { browser } from "wxt/browser";
import { loadConfig, setConfig } from "./deps";
import type { ContextMenuApi, Tab } from "@/utils/browser-actions";
import {
  addPagePattern,
  getSitePattern,
  matchesPageList,
  removeSitePattern,
} from "@/utils/page-patterns";

export const TRANSLATE_PAGE_COMMAND = "translate-page";
export const TOGGLE_SITE_COMMAND = "toggle-site-auto-translation";
const TRANSLATE_PAGE_MENU = "translate-page";

function notifyTab(tabId: number, message: unknown): void {
  void browser.tabs.sendMessage(tabId, message).catch(() => {});
}

export function togglePageForTab(tab?: Tab): void {
  if (tab?.id !== undefined) notifyTab(tab.id, { type: "mlg:togglePageTranslation" });
}

export async function toggleSiteForTab(tab?: Tab): Promise<void> {
  if (tab?.id === undefined || tab.url === undefined) return;
  const config = await loadConfig();
  if (!config.enabled) {
    notifyTab(tab.id, {
      type: "mlg:siteAutoTranslationChanged",
      payload: { enabled: false, status: "changed" },
    });
    return;
  }
  if (matchesPageList(config.pageListInclude, tab.url)) {
    const removed = removeSitePattern(config.pageListInclude, tab.url);
    if (removed.status === "broader-match") {
      notifyTab(tab.id, {
        type: "mlg:siteAutoTranslationChanged",
        payload: { enabled: false, status: "broader-match" },
      });
      return;
    }
    if (removed.status === "removed") {
      await setConfig({ pageListInclude: removed.pageListInclude });
      notifyTab(tab.id, {
        type: "mlg:siteAutoTranslationChanged",
        payload: { enabled: false, status: "changed" },
      });
    }
    return;
  }
  const pageListInclude = addPagePattern(config.pageListInclude, getSitePattern(tab.url));
  await setConfig({ pageListInclude });
  notifyTab(tab.id, {
    type: "mlg:siteAutoTranslationChanged",
    payload: { enabled: true, status: "changed" },
  });
}

export async function refreshContextMenus(
  menu: Readonly<ContextMenuApi>,
  tab?: Readonly<Tab>,
): Promise<void> {
  if (tab?.id === undefined || tab.url === undefined) return;
  const active = await browser.tabs
    .sendMessage(tab.id, { type: "mlg:getPageTranslationState" })
    .then((value: unknown) => isActivePageState(value))
    .catch(() => false);
  await Promise.resolve(
    menu.update(TRANSLATE_PAGE_MENU, {
      title: active ? "原文に戻す" : "このページを翻訳",
    }),
  );
  await Promise.resolve(menu.refresh?.());
}

function isActivePageState(value: unknown): boolean {
  return typeof value === "object" && value !== null && "active" in value && value.active === true;
}

export async function setupContextMenus(menu: Readonly<ContextMenuApi>): Promise<void> {
  await Promise.resolve(menu.removeAll());
  menu.create({ contexts: ["page"], id: TRANSLATE_PAGE_MENU, title: "このページを翻訳" });
  menu.onClicked.addListener((info, tab) => {
    if (info.menuItemId === TRANSLATE_PAGE_MENU) togglePageForTab(tab);
  });
  menu.onShown?.addListener((_info, tab) => {
    void refreshContextMenus(menu, tab);
  });
}
