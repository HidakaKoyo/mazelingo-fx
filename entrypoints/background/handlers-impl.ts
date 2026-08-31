import { browser } from "wxt/browser";
import { cache, explanationStore, getErrorMessage, loadConfig, norma, vocabStore } from "./deps";
import {
  buildExplainMessages,
  buildFeedbackMessages,
  buildQuizMessages,
  buildVocabAnalysisMessages,
} from "@/utils/prompts";
import { callLLMChain } from "@/utils/llm";
import { openExplanationSidePanel } from "@/utils/browser-actions";
import { translateBatch } from "@/utils/translate";
import {
  FEEDBACK_SCHEMA,
  QUIZ_SCHEMA,
  SENTENCE_EXPLANATION_SCHEMA,
  VOCAB_ANALYSIS_SCHEMA,
} from "@/utils/schemas";
import { matchVocabInText, normalizeVocab } from "@/utils/vocab";
import type {
  AddVocabPayload,
  AnalyzeVocabPayload,
  ExplainSentencePayload,
  FeedbackPayload,
  GenerateQuizPayload,
  NormaDonePayload,
  OpenExplanationPayload,
  OpenOutputPayload,
  RemoveVocabPayload,
  UpdateVocabPayload,
  VocabItem,
} from "@/utils/messages";

export type Sender = Readonly<{ tab?: Readonly<{ id?: number }> }>;

type OpenExplanationOutput = OpenExplanationPayload & { requestedAt: number };
type TranslateInput = {
  readonly from: "en" | "ja";
  readonly htmlBlocks: readonly string[];
  readonly to: "en" | "ja";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFeedbackResult(
  value: unknown,
): value is { corrected?: string; vocabSuggestions?: { en: string; ja: string }[] } {
  return isRecord(value);
}

function isQuizResult(value: unknown): value is { prompt: string } {
  return isRecord(value) && typeof value.prompt === "string";
}

function firstNonEmpty(values: readonly (string | undefined)[]): string {
  for (const value of values) {
    if (value !== undefined && value !== "") {
      return value;
    }
  }
  return "";
}

export async function clearCache(): Promise<{ ok: true }> {
  await cache.clear();
  return { ok: true };
}

export async function clearPendingExplanation(): Promise<{ ok: true }> {
  await explanationStore.clear();
  return { ok: true };
}

export function openOutput(payload: Readonly<OpenOutputPayload>): Promise<{ ok: true }> {
  void browser.runtime.sendMessage({ payload, type: "mlg:openOutput" }).catch(() => {});
  return Promise.resolve({ ok: true });
}

export async function openExplanation(
  payload: Readonly<OpenExplanationPayload>,
  sender: Sender,
): Promise<{ ok: true }> {
  const request: OpenExplanationOutput = { ...payload, requestedAt: Date.now() };
  await explanationStore.set(request);
  const tabId = sender.tab?.id;
  try {
    await openExplanationSidePanel(tabId);
  } catch (error) {
    console.warn("[mlg:bg] explanation side panel open failed:", getErrorMessage(error));
  }
  void browser.runtime
    .sendMessage({ payload: request, type: "mlg:openExplanation" })
    .catch(() => {});
  return { ok: true };
}

export async function normaDone(payload: Readonly<NormaDonePayload>): Promise<{ ok: true }> {
  await norma.markNormaDone(payload.textKey);
  const tabs = await browser.tabs.query({});
  for (const tab of tabs) {
    const tabId = tab.id;
    if (tabId !== undefined) {
      void browser.tabs.sendMessage(tabId, { payload, type: "mlg:normaDone" }).catch(() => {});
    }
  }
  return { ok: true };
}

export async function explainSentence(payload: Readonly<ExplainSentencePayload>): Promise<unknown> {
  const config = await loadConfig();
  const text = firstNonEmpty([payload.text, payload.englishText]).trim();
  const japaneseText = (payload.japaneseText ?? "").trim();
  if (text === "") {
    throw new Error("No sentence provided");
  }
  const messages = buildExplainMessages({
    japaneseText,
    pageUrl: payload.pageUrl,
    sourceLang: payload.sourceLang,
    text,
  });
  return callLLMChain(config.models, messages, config.apiKeys, SENTENCE_EXPLANATION_SCHEMA);
}

export async function feedback(payload: Readonly<FeedbackPayload>): Promise<unknown> {
  const config = await loadConfig();
  const rawResult: unknown = await callLLMChain(
    config.models,
    buildFeedbackMessages(payload),
    config.apiKeys,
    FEEDBACK_SCHEMA,
  );
  if (!isFeedbackResult(rawResult)) {
    return { error: "Unexpected feedback response" };
  }
  let vocabItems = await vocabStore.initIfNeeded();
  const matchedKeys = matchVocabInText(rawResult.corrected ?? "", vocabItems);
  if (matchedKeys.length > 0) {
    const keySet = new Set(matchedKeys.map((key) => key.toLowerCase()));
    vocabItems = vocabItems.map((item: Readonly<VocabItem>) =>
      keySet.has(item.en.toLowerCase()) ? { ...item, count: (item.count ?? 0) + 1 } : item,
    );
    await vocabStore.save(vocabItems);
  }
  const existingKeys = new Set(
    vocabItems.map((item: Readonly<VocabItem>) => normalizeVocab(item.en)),
  );
  const newSuggestions = (rawResult.vocabSuggestions ?? []).filter(
    (suggestion: Readonly<{ en: string; ja: string }>) =>
      !existingKeys.has(normalizeVocab(suggestion.en)),
  );
  rawResult.vocabSuggestions = newSuggestions;
  return { ...rawResult, matchedVocab: matchedKeys };
}

export async function addVocab(payload: Readonly<AddVocabPayload>): Promise<unknown> {
  const items = await vocabStore.initIfNeeded();
  const exists = items.some(
    (item: Readonly<VocabItem>) => item.en.toLowerCase() === payload.en.toLowerCase(),
  );
  if (!exists) {
    items.push({ count: 0, en: payload.en, ja: payload.ja, type: payload.type ?? "phrase" });
    await vocabStore.save(items);
  }
  return items;
}

export async function updateVocab(payload: Readonly<UpdateVocabPayload>): Promise<unknown> {
  const items = await vocabStore.initIfNeeded();
  const item = items.find(
    (entry: Readonly<VocabItem>) => entry.en.toLowerCase() === payload.en.toLowerCase(),
  );
  if (item !== undefined && payload.fields !== undefined) {
    Object.assign(item, payload.fields);
    await vocabStore.save(items);
  }
  return items;
}

export async function removeVocab(payload: Readonly<RemoveVocabPayload>): Promise<unknown> {
  const items = await vocabStore.initIfNeeded();
  const filtered = items.filter(
    (item: Readonly<VocabItem>) => item.en.toLowerCase() !== payload.en.toLowerCase(),
  );
  await vocabStore.save(filtered);
  return filtered;
}

export async function analyzeVocab(payload: Readonly<AnalyzeVocabPayload>): Promise<unknown> {
  const config = await loadConfig();
  return callLLMChain(
    config.models,
    buildVocabAnalysisMessages(payload.word),
    config.apiKeys,
    VOCAB_ANALYSIS_SCHEMA,
  );
}

export async function generateQuiz(
  payload: Readonly<GenerateQuizPayload>,
): Promise<{ prompt?: string; error?: string }> {
  try {
    const config = await loadConfig();
    const messages = buildQuizMessages(payload.situation);
    const result = await callLLMChain(config.models, messages, config.apiKeys, QUIZ_SCHEMA);
    if (!isQuizResult(result)) {
      return { error: "Unexpected quiz response" };
    }
    return { prompt: result.prompt };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function translate(payload: TranslateInput): Promise<unknown> {
  try {
    const result = await translateBatch(payload, {
      cache,
      getConfig: loadConfig,
      llm: callLLMChain,
    });
    return result;
  } catch (error) {
    const blockCount = Array.isArray(payload.htmlBlocks) ? payload.htmlBlocks.length : 0;
    const message = getErrorMessage(error);
    console.error("[mlg:bg] translate error:", {
      blockCount,
      error: message,
      missingIndices: Array.from({ length: blockCount }, (_, index) => index),
    });
    throw error;
  }
}
