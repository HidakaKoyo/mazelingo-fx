import { browser } from "wxt/browser";
import type {
  ExplanationResult,
  FeedbackResult,
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
