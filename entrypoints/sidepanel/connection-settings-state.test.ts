import { describe, expect, it } from "vitest";
import { connectionSummaries } from "./connection-settings-state";
import { translationModeTranslations } from "./translation-mode-translations";

function testProviderSummary(): void {
  it("shows provider translation usage and the connected count", () => {
    expect(
      connectionSummaries(
        {
          connectedProviderCount: 2,
          customServerUrl: "",
          hasModelChain: true,
          translationMode: "model-chain",
        },
        translationModeTranslations.ja,
      ),
    ).toEqual({
      customServer: "未使用 · URL 未設定",
      provider: "翻訳、解説、クイズ · 2件接続",
    });
  });
}

function testMissingModelPriority(): void {
  it("prioritizes the missing model chain over provider connections", () => {
    expect(
      connectionSummaries(
        {
          connectedProviderCount: 2,
          customServerUrl: "https://example.test:8443/v1",
          hasModelChain: false,
          translationMode: "model-chain",
        },
        translationModeTranslations.ja,
      ).provider,
    ).toBe("翻訳、解説、クイズ · モデル未設定");
  });
}

function testCustomServerSummary(): void {
  it.each(["plamo", "local-model"] as const)(
    "shows custom-server translation usage for %s",
    (translationMode) => {
      expect(
        connectionSummaries(
          {
            connectedProviderCount: 0,
            customServerUrl: "http://127.0.0.1:8765/v1",
            hasModelChain: true,
            translationMode,
          },
          translationModeTranslations.ja,
        ),
      ).toEqual({
        customServer: "翻訳 · 127.0.0.1:8765",
        provider: "解説、クイズ · 未接続",
      });
    },
  );
}

function testEnglishSummary(): void {
  it("uses the same usage-and-state shape in English", () => {
    expect(
      connectionSummaries(
        {
          connectedProviderCount: 2,
          customServerUrl: "",
          hasModelChain: true,
          translationMode: "model-chain",
        },
        translationModeTranslations.en,
      ).provider,
    ).toBe("Translation, explanations, quizzes · 2 connected");
  });
}

describe("connection summaries", () => {
  testProviderSummary();
  testMissingModelPriority();
  testCustomServerSummary();
  testEnglishSummary();
});
