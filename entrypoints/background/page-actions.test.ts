import { beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "@/utils/config";

const mocks = vi.hoisted(() => ({ loadConfig: vi.fn(), sendMessage: vi.fn(), setConfig: vi.fn() }));

vi.mock("wxt/browser", () => ({ browser: { tabs: { sendMessage: mocks.sendMessage } } }));
vi.mock("./deps", () => ({ loadConfig: mocks.loadConfig, setConfig: mocks.setConfig }));

import { setupContextMenus, toggleSiteForTab } from "./page-actions";
import type { ContextMenuApi } from "@/utils/browser-actions";

const tab = { id: 3, url: "https://example.com/article" };

beforeEach(() => {
  Object.values(mocks).forEach((mock) => {
    mock.mockReset();
  });
  mocks.sendMessage.mockResolvedValue(null);
  mocks.setConfig.mockResolvedValue(DEFAULT_CONFIG);
});

it("adds the current site and asks the page to translate", async () => {
  mocks.loadConfig.mockResolvedValue({ ...DEFAULT_CONFIG, pageListInclude: "" });

  await toggleSiteForTab(tab);

  expect(mocks.setConfig).toHaveBeenCalledWith({
    pageListInclude: "https://example.com/*",
  });
  expect(mocks.sendMessage).toHaveBeenCalledWith(3, {
    payload: { enabled: true, status: "changed" },
    type: "mlg:siteAutoTranslationChanged",
  });
});

it("removes the exact site entry and asks the page to restore", async () => {
  mocks.loadConfig.mockResolvedValue({
    ...DEFAULT_CONFIG,
    pageListInclude: "https://example.com/*\nhttps://other.test/*",
  });

  await toggleSiteForTab(tab);

  expect(mocks.setConfig).toHaveBeenCalledWith({ pageListInclude: "https://other.test/*" });
  expect(mocks.sendMessage).toHaveBeenCalledWith(3, {
    payload: { enabled: false, status: "changed" },
    type: "mlg:siteAutoTranslationChanged",
  });
});

it("reports a broader match without changing settings", async () => {
  mocks.loadConfig.mockResolvedValue({ ...DEFAULT_CONFIG, pageListInclude: "https://*" });

  await toggleSiteForTab(tab);

  expect(mocks.setConfig).not.toHaveBeenCalled();
  expect(mocks.sendMessage).toHaveBeenCalledWith(3, {
    payload: { enabled: false, status: "broader-match" },
    type: "mlg:siteAutoTranslationChanged",
  });
});

it("does not change settings while translation is disabled", async () => {
  mocks.loadConfig.mockResolvedValue({ ...DEFAULT_CONFIG, enabled: false });

  await toggleSiteForTab(tab);

  expect(mocks.setConfig).not.toHaveBeenCalled();
  expect(mocks.sendMessage).toHaveBeenCalledOnce();
});

it("creates only the page translation context-menu item", async () => {
  const create = vi.fn();
  const menu: ContextMenuApi = {
    create,
    onClicked: { addListener: (): void => {} },
    onShown: { addListener: (): void => {} },
    removeAll: vi.fn(),
    update: vi.fn(),
  };

  await setupContextMenus(menu);

  expect(create).toHaveBeenCalledOnce();
  expect(create).toHaveBeenCalledWith({
    contexts: ["page"],
    id: "translate-page",
    title: "このページを翻訳",
  });
});
