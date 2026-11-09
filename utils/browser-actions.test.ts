import { describe, expect, it, vi } from "vitest";
import type { ContextMenuApi } from "./browser-actions";
import {
  getContextMenuApiWith,
  openExplanationSidePanelWith,
  openToolbarPanelWith,
} from "./browser-actions";

function createMenu(): ContextMenuApi {
  return {
    create: vi.fn(),
    onClicked: { addListener: (): void => {} },
    refresh: vi.fn(),
    removeAll: vi.fn(),
    update: vi.fn(),
  };
}

it("prefers Firefox menus and falls back to Chromium contextMenus", () => {
  const firefoxMenus = createMenu();
  const chromeMenus = createMenu();
  expect(getContextMenuApiWith({ contextMenus: chromeMenus, menus: firefoxMenus })).toBe(
    firefoxMenus,
  );
  expect(getContextMenuApiWith({ contextMenus: chromeMenus })).toBe(chromeMenus);
});

describe("openToolbarPanelWith", () => {
  it("opens the Firefox sidebar synchronously", async () => {
    const calls: string[] = [];
    const pending = Promise.resolve();
    const open = vi.fn(() => {
      calls.push("open");
      return pending;
    });

    const result = openToolbarPanelWith({ sidebarAction: { open } }, 42);

    expect(calls).toEqual(["open"]);
    expect(open).toHaveBeenCalledOnce();
    await result;
  });

  it("opens the Chrome side panel for the requested tab", async () => {
    const open = vi.fn(() => Promise.resolve());

    await openToolbarPanelWith({ sidePanel: { open } }, 42);

    expect(open).toHaveBeenCalledWith({ tabId: 42 });
  });

  it("prefers the Firefox sidebar when both APIs are present", async () => {
    const openSidebar = vi.fn(() => Promise.resolve());
    const openSidePanel = vi.fn(() => Promise.resolve());

    await openToolbarPanelWith(
      { sidebarAction: { open: openSidebar }, sidePanel: { open: openSidePanel } },
      42,
    );

    expect(openSidebar).toHaveBeenCalledOnce();
    expect(openSidePanel).not.toHaveBeenCalled();
  });

  it("does not call the Chrome API without a tab id", async () => {
    const open = vi.fn(() => Promise.resolve());

    await openToolbarPanelWith({ sidePanel: { open } });

    expect(open).not.toHaveBeenCalled();
  });
});

describe("openExplanationSidePanelWith", () => {
  it("opens the Chrome side panel for an explanation request", async () => {
    const open = vi.fn(() => Promise.resolve());

    await openExplanationSidePanelWith({ sidePanel: { open } }, 42);

    expect(open).toHaveBeenCalledWith({ tabId: 42 });
  });

  it("does not call the Firefox sidebar outside a toolbar user action", async () => {
    const openSidebar = vi.fn(() => Promise.resolve());

    await openExplanationSidePanelWith({ sidebarAction: { open: openSidebar } }, 42);

    expect(openSidebar).not.toHaveBeenCalled();
  });

  it("does not fall back to the Firefox sidebar when both APIs are present", async () => {
    const openSidebar = vi.fn(() => Promise.resolve());
    const openSidePanel = vi.fn(() => Promise.resolve());

    await openExplanationSidePanelWith(
      { sidebarAction: { open: openSidebar }, sidePanel: { open: openSidePanel } },
      42,
    );

    expect(openSidePanel).toHaveBeenCalledWith({ tabId: 42 });
    expect(openSidebar).not.toHaveBeenCalled();
  });
});
