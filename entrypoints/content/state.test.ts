// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "@/utils/config";
import { STORAGE_KEY } from "@/utils/keys";

const browserMocks = vi.hoisted(() => ({
  get: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock("wxt/browser", () => ({
  browser: {
    runtime: { sendMessage: browserMocks.sendMessage },
    storage: { local: { get: browserMocks.get } },
  },
}));

import { loadConfig, sendMessage, shouldTranslatePage, STATE, updatePageMatchers } from "./state";

describe("content state browser boundary", () => {
  beforeEach(() => {
    browserMocks.get.mockReset();
    browserMocks.sendMessage.mockReset();
  });

  it("starts a new document without an explicit page translation request", () => {
    expect(STATE.pageTranslationOverride).toBeNull();
  });

  it("converts a rejected runtime message into a RuntimeError", async () => {
    browserMocks.sendMessage.mockRejectedValue(new Error("service worker unavailable"));

    await expect(sendMessage({ type: "mlg:getCacheStats" })).resolves.toEqual({
      error: "service worker unavailable",
    });
  });

  it("merges a saved partial config with defaults", async () => {
    browserMocks.get.mockResolvedValue({
      [STORAGE_KEY]: {
        apiKeys: { openrouter: "stored-value" },
        enabled: false,
        models: ["openrouter/deepseek/deepseek-chat"],
      },
    });

    await expect(loadConfig()).resolves.toEqual({
      ...DEFAULT_CONFIG,
      apiKeys: { openrouter: "stored-value" },
      enabled: false,
      models: ["openrouter/deepseek/deepseek-chat"],
    });
  });

  it("returns defaults when no config is stored", async () => {
    browserMocks.get.mockResolvedValue({});

    await expect(loadConfig()).resolves.toEqual(DEFAULT_CONFIG);
  });
});

describe("automatic translation conditions", () => {
  it.each([
    [false, false, false, false],
    [false, false, false, true],
    [false, false, true, false],
    [false, false, true, true],
    [false, true, false, false],
    [false, true, false, true],
    [false, true, true, false],
    [false, true, true, true],
    [true, false, false, false],
    [true, false, false, true],
    [true, false, true, false],
    [true, false, true, true],
    [true, true, false, false],
    [true, true, false, true],
    [true, true, true, false],
    [true, true, true, true],
  ])(
    "requires enabled=%s, autoTranslate=%s, include=%s, exclude=%s",
    (enabled, autoTranslate, included, excluded) => {
      STATE.config = {
        ...DEFAULT_CONFIG,
        autoTranslate,
        enabled,
        pageListExclude: excluded ? "*" : "",
        pageListInclude: included ? "*" : "",
      };
      STATE.pageTranslationOverride = null;
      updatePageMatchers();

      expect(shouldTranslatePage()).toBe(enabled && autoTranslate && included && !excluded);
    },
  );

  it("keeps an explicitly requested page active while automatic translation is off", () => {
    STATE.config = { ...DEFAULT_CONFIG, autoTranslate: false, enabled: true };
    STATE.pageTranslationOverride = "on";
    updatePageMatchers();

    expect(shouldTranslatePage()).toBe(true);
  });
});
