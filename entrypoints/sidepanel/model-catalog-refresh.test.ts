import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, type Config } from "@/utils/config";
import { getChangedCatalogProviders, hasOpenRouterApiKeyChanged } from "./model-catalog-refresh";

function config(apiKeys: Readonly<Record<string, string>> = {}): Config {
  return {
    ...DEFAULT_CONFIG,
    apiKeys,
  };
}

describe("hasOpenRouterApiKeyChanged", () => {
  it("detects a newly saved or replaced OpenRouter key", () => {
    expect(hasOpenRouterApiKeyChanged(config(), config({ openrouter: "first-key" }))).toBe(true);
    expect(
      hasOpenRouterApiKeyChanged(
        config({ openrouter: "first-key" }),
        config({ openrouter: "next-key" }),
      ),
    ).toBe(true);
  });

  it("detects a removed OpenRouter key", () => {
    expect(hasOpenRouterApiKeyChanged(config({ openrouter: "saved-key" }), config())).toBe(true);
  });

  it("does not refresh for unrelated saves or before a saved state exists", () => {
    expect(
      hasOpenRouterApiKeyChanged(
        config({ openrouter: "saved-key" }),
        config({ openrouter: "saved-key" }),
      ),
    ).toBe(false);
    expect(hasOpenRouterApiKeyChanged(null, config({ openrouter: "saved-key" }))).toBe(false);
  });
});

describe("getChangedCatalogProviders", () => {
  it("returns changed catalog providers in stable catalog order", () => {
    expect(
      getChangedCatalogProviders(
        config({
          claude: "old-claude-key",
          gemini: "old-gemini-key",
          gpt: "old-openai-key",
          openrouter: "old-openrouter-key",
          deepseek: "unchanged-key",
        }),
        config({
          claude: "new-claude-key",
          gemini: "",
          gpt: "",
          openrouter: "old-openrouter-key",
          deepseek: "next-key",
        }),
      ),
    ).toEqual(["gpt", "claude", "gemini"]);
  });

  it("does not discover changed providers before a saved config exists", () => {
    expect(getChangedCatalogProviders(null, config({ gpt: "new-openai-key" }))).toEqual([]);
  });
});
