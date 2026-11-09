import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  sendMessage: vi.fn(),
  set: vi.fn(),
}));

vi.mock(
  "wxt/utils/define-background",
  (): { defineBackground: (setup: () => void) => () => void } => ({
    defineBackground: (setup: () => void): (() => void) => setup,
  }),
);
vi.mock("wxt/browser", () => ({
  browser: {
    action: { onClicked: { addListener: vi.fn() } },
    commands: { onCommand: { addListener: vi.fn() } },
    runtime: { onInstalled: { addListener: vi.fn() }, onMessage: { addListener: vi.fn() } },
    storage: { local: { get: mocks.get, set: mocks.set } },
    tabs: { sendMessage: mocks.sendMessage },
  },
}));
vi.mock("@/utils/browser-actions", () => ({
  getContextMenuApi: vi.fn(),
  openToolbarPanel: vi.fn(),
}));
vi.mock("./handlers", () => ({ handleMessage: vi.fn() }));
vi.mock("./page-actions", () => ({
  setupContextMenus: vi.fn(),
  togglePageForTab: mocks.sendMessage,
  toggleSiteForTab: vi.fn(),
  TOGGLE_SITE_COMMAND: "toggle-site-auto-translation",
  TRANSLATE_PAGE_COMMAND: "translate-page",
}));

const { handleCommand, initializeConfigIfNeeded } = await import("./setup");

beforeEach(() => {
  Object.values(mocks).forEach((mock) => {
    mock.mockReset();
  });
});

describe("background shortcut", () => {
  it("routes only the page translation command", () => {
    handleCommand("other-command", { id: 3 });
    expect(mocks.sendMessage).not.toHaveBeenCalled();
    handleCommand("translate-page", { id: 3 });
    expect(mocks.sendMessage).toHaveBeenCalledWith({ id: 3 });
  });
});

describe("automatic translation default migration", () => {
  it("clears the old default and records the migration", async () => {
    mocks.get.mockResolvedValue({ mlg_config: { pageListInclude: "https://*" } });

    await initializeConfigIfNeeded();

    expect(mocks.set).toHaveBeenCalledOnce();
    const saved: unknown = mocks.set.mock.calls[0]?.[0];
    expect(saved).toMatchObject({
      mlg_config: {
        pageListDefaultMigrated: true,
        pageListInclude: "",
      },
    });
  });

  it("does not rewrite a later explicit https wildcard", async () => {
    mocks.get.mockResolvedValue({
      mlg_config: { pageListDefaultMigrated: true, pageListInclude: "https://*" },
    });

    await initializeConfigIfNeeded();

    expect(mocks.set).not.toHaveBeenCalled();
  });
});
