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
