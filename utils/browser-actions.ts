import { browser } from "wxt/browser";

interface SidebarActionApi {
  readonly open: () => Promise<void> | void;
}

interface SidePanelApi {
  readonly open: (options: Readonly<{ tabId: number }>) => Promise<void> | void;
}

export interface PanelBrowser {
  readonly sidebarAction?: SidebarActionApi;
  readonly sidePanel?: SidePanelApi;
}

export interface ContextMenuApi {
  readonly create: (properties: Readonly<Record<string, unknown>>) => unknown;
  readonly onClicked: Readonly<{
    addListener: (
      listener: (info: Readonly<{ menuItemId: string | number }>, tab?: Tab) => void,
    ) => void;
  }>;
  readonly onShown?: Readonly<{
    addListener: (listener: (info: unknown, tab?: Tab) => void) => void;
  }>;
  readonly refresh?: () => Promise<void> | void;
  readonly removeAll: () => Promise<void> | void;
  readonly update: (
    id: string,
    properties: Readonly<Record<string, unknown>>,
  ) => Promise<void> | void;
}

export interface Tab {
  readonly id?: number;
  readonly url?: string;
}

interface ContextMenuBrowser {
  readonly contextMenus?: Readonly<ContextMenuApi>;
  readonly menus?: Readonly<ContextMenuApi>;
}

export function getContextMenuApiWith(
  menuBrowser: Readonly<ContextMenuBrowser>,
): ContextMenuApi | undefined {
  return menuBrowser.menus ?? menuBrowser.contextMenus;
}

export function getContextMenuApi(): ContextMenuApi | undefined {
  return getContextMenuApiWith(browser);
}

function openChromeSidePanelWith(
  panelBrowser: Readonly<PanelBrowser>,
  tabId?: number,
): Promise<void> {
  const sidePanel = panelBrowser.sidePanel;
  if (tabId !== undefined && typeof sidePanel?.open === "function") {
    return Promise.resolve(sidePanel.open({ tabId }));
  }

  return Promise.resolve();
}

export function openToolbarPanelWith(
  panelBrowser: Readonly<PanelBrowser>,
  tabId?: number,
): Promise<void> {
  const sidebarAction = panelBrowser.sidebarAction;
  if (typeof sidebarAction?.open === "function") {
    return Promise.resolve(sidebarAction.open());
  }

  return openChromeSidePanelWith(panelBrowser, tabId);
}

export function openExplanationSidePanelWith(
  panelBrowser: Readonly<PanelBrowser>,
  tabId?: number,
): Promise<void> {
  return openChromeSidePanelWith(panelBrowser, tabId);
}

export function openToolbarPanel(tabId: number | undefined): Promise<void> {
  return openToolbarPanelWith(browser, tabId);
}

export function openExplanationSidePanel(tabId: number | undefined): Promise<void> {
  return openExplanationSidePanelWith(browser, tabId);
}
