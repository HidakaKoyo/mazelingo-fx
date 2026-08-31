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

import { loadConfig, sendMessage } from "./state";

describe("content state browser boundary", () => {
  beforeEach(() => {
    browserMocks.get.mockReset();
    browserMocks.sendMessage.mockReset();
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
