import {
  cache,
  explanationStore,
  getErrorMessage,
  loadConfig,
  norma,
  setConfig,
  tts,
  vocabStore,
} from "./deps";
import {
  addVocab,
  analyzeVocab,
  clearCache,
  clearPendingExplanation,
  explainSentence,
  feedback,
  generateQuiz,
  normaDone,
  openExplanation,
  openOutput,
  removeVocab,
  translate,
  updateVocab,
} from "./handlers-impl";
import type { Sender } from "./handlers-impl";
export type { Sender } from "./handlers-impl";
import type { MlgMessage } from "@/utils/messages";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMlgMessage(value: unknown): value is MlgMessage {
  return isRecord(value) && typeof value.type === "string";
}

function respondAsync<T>(
  promise: Readonly<Promise<T>>,
  sendResponse: (response?: unknown) => void,
): boolean {
  void (async (): Promise<void> => {
    try {
      sendResponse(await promise);
    } catch (error) {
      sendResponse({ error: getErrorMessage(error) });
    }
  })();
  return true;
}

function dispatch(message: MlgMessage, sender: Sender): Promise<unknown> | undefined {
  switch (message.type) {
    case "mlg:readerRun":
      return undefined;
    case "mlg:getConfig":
      return loadConfig();
    case "mlg:setConfig":
      return setConfig(message.payload);
    case "mlg:getCacheStats":
      return cache.getCacheStats();
    case "mlg:clearCache":
      return clearCache();
    case "mlg:normaDone":
      return normaDone(message.payload);
    case "mlg:normaCheck":
      return norma.checkNormaDone(message.payload.textKeys ?? []);
    case "mlg:openOutput":
      return openOutput(message.payload);
    case "mlg:openExplanation":
      return openExplanation(message.payload, sender);
    case "mlg:getPendingExplanation":
      return explanationStore.get();
    case "mlg:clearPendingExplanation":
      return clearPendingExplanation();
    case "mlg:explainSentence":
      return explainSentence(message.payload);
    case "mlg:feedback":
      return feedback(message.payload);
    case "mlg:getVocab":
      return vocabStore.initIfNeeded();
    case "mlg:addVocab":
      return addVocab(message.payload);
    case "mlg:updateVocab":
      return updateVocab(message.payload);
    case "mlg:removeVocab":
      return removeVocab(message.payload);
    case "mlg:analyzeVocab":
      return analyzeVocab(message.payload);
    case "mlg:generateQuiz":
      return generateQuiz(message.payload);
    case "mlg:tts":
      return tts(message.payload);
    case "mlg:translate":
      return translate(message.payload);
    default:
      return undefined;
  }
}

export function handleMessage(
  message: unknown,
  sender: Sender,
  sendResponse: (response?: unknown) => void,
): boolean {
  if (!isMlgMessage(message)) {
    return false;
  }
  const result = dispatch(message, sender);
  if (result === undefined) {
    return false;
  }
  return respondAsync(result, sendResponse);
}
