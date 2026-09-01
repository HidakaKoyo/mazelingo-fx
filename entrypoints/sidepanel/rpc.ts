import { browser } from "wxt/browser";
import { isCatalogProviderId, type CatalogProviderId } from "@/utils/model-catalog";
import type {
  ExplanationResult,
  FeedbackResult,
  ModelCatalogEntry,
  ModelCatalogResponse,
  OpenExplanationPayload,
  SuggestionItem,
  TtsResponse,
  VocabAnalysis,
  VocabItem,
} from "@/utils/messages";

export interface QuizResponse {
  prompt?: string;
  error?: string;
}

export interface CacheStatsResponse {
  entries: number;
  bytes: number;
}

export interface AnalyzeResponse extends VocabAnalysis {
  error?: string;
}

export interface FeedbackResponse extends FeedbackResult {
  error?: string;
}

export interface ExplanationResponse extends ExplanationResult {
  error?: string;
}

export type VocabSuggestions = SuggestionItem[];

function isQuizResponse(x: unknown): x is QuizResponse {
  return typeof x === "object" && x !== null && ("prompt" in x || "error" in x);
}

function isVocabItemArray(x: unknown): x is VocabItem[] {
  return Array.isArray(x);
}

function isAnalyzeResponse(x: unknown): x is AnalyzeResponse {
  return typeof x === "object" && x !== null && ("frequency" in x || "error" in x);
}

function isFeedbackResponse(x: unknown): x is FeedbackResponse {
  return typeof x === "object" && x !== null && ("overall" in x || "error" in x);
}

function isExplanationResponse(x: unknown): x is ExplanationResponse {
  return typeof x === "object" && x !== null && ("translation" in x || "error" in x);
}

function isTtsResponse(x: unknown): x is TtsResponse {
  return typeof x === "object" && x !== null && ("dataUrl" in x || "error" in x);
}

function isCacheStatsResponse(x: unknown): x is CacheStatsResponse {
  return typeof x === "object" && x !== null && "entries" in x;
}

function isPendingExplanation(x: unknown): x is OpenExplanationPayload {
  return typeof x === "object" && x !== null && "text" in x;
}

function isModelCatalogEntry(x: unknown): x is ModelCatalogEntry {
  if (typeof x !== "object" || x === null || !("id" in x) || !("name" in x)) {
    return false;
  }
  return typeof x.id === "string" && typeof x.name === "string";
}

function isModelCatalogResponse(x: unknown): x is ModelCatalogResponse {
  if (typeof x !== "object" || x === null || !("models" in x) || !("status" in x)) {
    return false;
  }
  const status = x.status;
  if (status !== "ready" && status !== "not-configured" && status !== "failed") {
    return false;
  }
  const models: unknown = x.models;
  if (!Array.isArray(models) || !models.every((model) => isModelCatalogEntry(model))) {
    return false;
  }
  if (!("providers" in x)) return false;
  const providers: unknown = x.providers;
  return (
    Array.isArray(providers) &&
    providers.every((provider) => isModelCatalogProviderResult(provider))
  );
}

function isModelCatalogProviderResult(x: unknown): boolean {
  if (typeof x !== "object" || x === null) return false;
  if (!("provider" in x) || !("status" in x) || !("models" in x)) return false;
  if (!isCatalogProviderId(x.provider)) return false;
  if (x.status !== "ready" && x.status !== "not-configured" && x.status !== "failed") {
    return false;
  }
  return Array.isArray(x.models) && x.models.every((model) => isModelCatalogEntry(model));
}

function isCatalogProviderIdArray(value: unknown): value is readonly CatalogProviderId[] {
  return Array.isArray(value) && value.every((provider) => isCatalogProviderId(provider));
}

export async function generateQuiz(situation: string): Promise<QuizResponse | undefined> {
  const res: unknown = await browser.runtime.sendMessage({
    payload: { situation },
    type: "mlg:generateQuiz",
  });
  return isQuizResponse(res) ? res : undefined;
}

export async function getVocab(): Promise<VocabItem[] | undefined> {
  const res: unknown = await browser.runtime.sendMessage({ type: "mlg:getVocab" });
  return isVocabItemArray(res) ? res : undefined;
}

export async function addVocabRpc(
  en: string,
  ja: string,
  type: string,
): Promise<VocabItem[] | undefined> {
  const res: unknown = await browser.runtime.sendMessage({
    payload: { en, ja, type },
    type: "mlg:addVocab",
  });
  return isVocabItemArray(res) ? res : undefined;
}

export async function updateVocab(
  en: string,
  fields: Readonly<Partial<VocabItem>>,
): Promise<VocabItem[] | undefined> {
  const res: unknown = await browser.runtime.sendMessage({
    payload: { en, fields },
    type: "mlg:updateVocab",
  });
  return isVocabItemArray(res) ? res : undefined;
}

export async function removeVocabRpc(en: string): Promise<VocabItem[] | undefined> {
  const res: unknown = await browser.runtime.sendMessage({
    payload: { en },
    type: "mlg:removeVocab",
  });
  return isVocabItemArray(res) ? res : undefined;
}

export async function analyzeVocab(word: string): Promise<AnalyzeResponse | undefined> {
  const res: unknown = await browser.runtime.sendMessage({
    payload: { word },
    type: "mlg:analyzeVocab",
  });
  return isAnalyzeResponse(res) ? res : undefined;
}

export async function feedback(
  payload: Readonly<{ mode: string; sourceText: string; userText: string }>,
): Promise<FeedbackResponse | undefined> {
  const res: unknown = await browser.runtime.sendMessage({ payload, type: "mlg:feedback" });
  return isFeedbackResponse(res) ? res : undefined;
}

export async function explainSentence(
  payload: Readonly<OpenExplanationPayload>,
): Promise<ExplanationResponse | undefined> {
  const res: unknown = await browser.runtime.sendMessage({ payload, type: "mlg:explainSentence" });
  return isExplanationResponse(res) ? res : undefined;
}

export async function tts(text: string, voice: string): Promise<TtsResponse | undefined> {
  const res: unknown = await browser.runtime.sendMessage({
    payload: { text, voice },
    type: "mlg:tts",
  });
  return isTtsResponse(res) ? res : undefined;
}

export async function getCacheStatsRpc(): Promise<CacheStatsResponse | undefined> {
  const res: unknown = await browser.runtime.sendMessage({ type: "mlg:getCacheStats" });
  return isCacheStatsResponse(res) ? res : undefined;
}

export async function clearCacheRpc(): Promise<void> {
  await browser.runtime.sendMessage({ type: "mlg:clearCache" });
}

export async function refreshModelCatalogRpc(
  providers?: readonly CatalogProviderId[],
): Promise<ModelCatalogResponse | undefined> {
  if (providers !== undefined && !isCatalogProviderIdArray(providers)) return undefined;
  const payload = providers === undefined ? undefined : { providers };
  const res: unknown = await browser.runtime.sendMessage({
    ...(payload === undefined ? {} : { payload }),
    type: "mlg:refreshModelCatalog",
  });
  return isModelCatalogResponse(res) ? res : undefined;
}

export async function clearPendingExplanation(): Promise<void> {
  await browser.runtime.sendMessage({ type: "mlg:clearPendingExplanation" });
}

export async function getPendingExplanation(): Promise<OpenExplanationPayload | undefined> {
  const res: unknown = await browser.runtime.sendMessage({ type: "mlg:getPendingExplanation" });
  return isPendingExplanation(res) ? res : undefined;
}

export async function normaDone(textKey: string): Promise<void> {
  await browser.runtime.sendMessage({ payload: { textKey }, type: "mlg:normaDone" });
}
