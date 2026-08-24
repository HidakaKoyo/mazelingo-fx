import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, mergeConfig } from "./config";
import type { Config } from "./config";

function isMergeInput(value: unknown): value is Partial<Config> {
  return typeof value === "object" && value !== null;
}

describe("mergeConfig", () => {
  it("returns DEFAULT_CONFIG when given no raw value", () => {
    expect(mergeConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(mergeConfig({})).toEqual(DEFAULT_CONFIG);
  });

  it("merges provided values over the defaults", () => {
    const result = mergeConfig({ enabled: false, englishRatio: 60 });
    expect(result.enabled).toBe(false);
    expect(result.englishRatio).toBe(60);
    // untouched defaults remain
    expect(result.models).toEqual(["gpt-5.2"]);
    expect(result.minTextLength).toBe(5);
  });

  it("defaults an invalid models value to DEFAULT_CONFIG.models", () => {
    const raw: unknown = { models: "not-an-array" };
    if (!isMergeInput(raw)) throw new Error("expected a config object");
    const result = mergeConfig(raw);
    expect(result.models).toEqual(DEFAULT_CONFIG.models);
  });

  it("deep-merges apiKeys rather than replacing the object", () => {
    const base = mergeConfig({ apiKeys: { gpt: "abc" } });
    const merged = mergeConfig({ apiKeys: { claude: "xyz" } });
    expect(merged.apiKeys).toEqual({ claude: "xyz" });
    expect(mergeConfig(base).apiKeys.gpt).toBe("abc");
  });

  it("strips legacy positional config keys", () => {
    const raw: unknown = {
      providerId: "old",
      apiKey: "secret",
      providerOptions: { x: 1 },
    };
    if (!isMergeInput(raw)) throw new Error("expected a config object");
    const result = mergeConfig(raw);
    expect("providerId" in result).toBe(false);
    expect("apiKey" in result).toBe(false);
    expect("providerOptions" in result).toBe(false);
  });

  it("uses the single source of truth defaults (gpt-5.2, minTextLength 5)", () => {
    const result = mergeConfig({});
    expect(result.models).toEqual(["gpt-5.2"]);
    expect(result.minTextLength).toBe(5);
  });
});
