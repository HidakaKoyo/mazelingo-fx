import { describe, expect, it } from "vitest";

function expectExplainPayload(value: unknown): {
  sentence: string;
  japaneseTranslation: string;
} {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("expected explain payload");
  }
  const sentence = "sentence" in value ? value.sentence : undefined;
  const japaneseTranslation =
    "japaneseTranslation" in value ? value.japaneseTranslation : undefined;
  if (typeof sentence !== "string" || typeof japaneseTranslation !== "string") {
    throw new TypeError("expected explain payload");
  }
  return { sentence, japaneseTranslation };
}

function expectMessage(message: ChatMessage | undefined): ChatMessage {
  if (!message) throw new Error("expected a message");
  return message;
}
import {
  buildExplainMessages,
  buildFeedbackMessages,
  buildQuizMessages,
  buildVocabAnalysisMessages,
} from "./prompts";
import type { ChatMessage } from "./llm";

describe("buildFeedbackMessages", () => {
  it("sets quiz mode to evaluate the response to a scenario", () => {
    const [system] = buildFeedbackMessages({
      mode: "quiz",
      sourceText: "You want coffee.",
      userText: "I would like a medium roast.",
    });
    expect(expectMessage(system).content).toContain(
      'responding to a conversation prompt: "You want coffee."',
    );
  });

  it("uses free-form mode when no source text exists", () => {
    const [system] = buildFeedbackMessages({ mode: undefined, sourceText: "", userText: "hello" });
    expect(expectMessage(system).content).toContain("practicing free-form English writing");
  });

  it("passes both original and user writing when source text exists", () => {
    const [, user] = buildFeedbackMessages({
      mode: "opinion",
      sourceText: "an original",
      userText: "my response",
    });
    expect(expectMessage(user).content).toBe(
      '{"originalText":"an original","userWriting":"my response"}',
    );
  });
});

describe("buildVocabAnalysisMessages", () => {
  it("embeds the word as the user turn", () => {
    const [, user] = buildVocabAnalysisMessages("however");
    expect(expectMessage(user).content).toBe("however");
    expect(expectMessage(user).role).toBe("user");
  });
});

describe("buildExplainMessages", () => {
  it("serializes only the sentence, optional Japanese translation, and source language", () => {
    const [, user] = buildExplainMessages({ japaneseText: "やあ", text: "Hello there" });
    const content = expectMessage(user).content;
    const parsed = expectExplainPayload(JSON.parse(content));
    expect(parsed.sentence).toBe("Hello there");
    expect(parsed.japaneseTranslation).toBe("やあ");
    expect(content).toBe('{"sentence":"Hello there","japaneseTranslation":"やあ"}');
  });
});

describe("buildQuizMessages", () => {
  it("embeds the situation", () => {
    const [, user] = buildQuizMessages("A rainy day");
    expect(expectMessage(user).content).toBe("A rainy day");
  });
});
