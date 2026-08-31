/**
 * Typed message protocol shared across the three extension contexts:
 * background, content script, and the side panel.
 *
 * Every `mlg:*` message (previously a stringly-typed convention scattered
 * across files) is now a discriminated union. `MlgMessage` is the payload
 * carried by an incoming `browser.runtime.onMessage`; responses are typed
 * independently so each sender knows the shape it gets back.
 */

export type Language = "en" | "ja";

export interface TranslationUnit {
  source: string;
  translation: string;
}

export interface TranslationBlock {
  sentences: TranslationUnit[];
}

export interface IndexedBlock {
  i: number;
  html: string;
}

export interface VocabItem {
  en: string;
  ja: string;
  type?: string;
  count: number;
  reviewCount?: number;
  frequency?: string;
  analysis?: unknown;
  reanalyzed?: boolean;
}

export interface CacheStats {
  entries: number;
  bytes: number;
}

export interface ExplanationChunk {
  text: string;
  role: string;
  explanation: string;
}

export interface SuggestionItem {
  en: string;
  ja: string;
  angle?: string;
}

export interface VocabAnalysis {
  meaning: {
    definition: string;
    coreImage: string;
    nativeFeel: string;
    usageScene: string;
  };
  frequency: string;
  difficulty: string;
  etymology: string;
  pronunciation: { ipa: string; googleTranslateUrl: string };
  examples: SuggestionItem[];
  collocations: SuggestionItem[];
  relatedWords: { synonyms: string[]; antonyms: string[]; derivatives: string[] };
}

export interface FeedbackItem {
  original: string;
  corrected: string;
  explanation: string;
}

export interface FeedbackResult {
  corrected?: string;
  feedback: FeedbackItem[];
  overall: string;
  alternativeExamples: SuggestionItem[];
  vocabSuggestions: SuggestionItem[];
  matchedVocab?: string[];
}

export interface GrammarPoint {
  title: string;
  explanation: string;
}

export interface ExplanationResult {
  headline?: string;
  translation?: string;
  overview?: string;
  chunks?: ExplanationChunk[];
  grammarPoints?: GrammarPoint[];
  vocabulary?: { term: string; meaning: string; nuance: string }[];
  readingSteps?: string[];
}

// --- Request payloads ---

export interface TranslatePayload {
  htmlBlocks: string[];
  from: Language;
  to: Language;
}

export interface NormaDonePayload {
  textKey: string;
}

export interface NormaCheckPayload {
  textKeys: string[];
}

export interface OpenOutputPayload {
  tabId?: number;
  pageUrl?: string;
  text?: string;
  origin?: string;
}

export interface OpenExplanationPayload {
  requestedAt?: number;
  text?: string;
  sentence?: string;
  englishText?: string;
  japaneseText?: string;
  sourceText?: string;
  sourceLang?: string;
  origin?: string;
}

export interface ExplainSentencePayload {
  text?: string;
  englishText?: string;
  japaneseText?: string;
  sourceLang?: string;
}

export interface FeedbackPayload {
  sourceText: string;
  userText: string;
  mode?: "quiz" | "rephrase" | "opinion";
}

export interface AnalyzeVocabPayload {
  word: string;
}

export interface GenerateQuizPayload {
  situation: string;
}

export interface AddVocabPayload {
  en: string;
  ja: string;
  type?: string;
}

export interface UpdateVocabPayload {
  en: string;
  fields: Partial<VocabItem>;
}

export interface RemoveVocabPayload {
  en: string;
}

export interface TtsPayload {
  text: string;
  voice?: string;
}

export type SetConfigPayload = Record<string, unknown>;

// --- Response types ---

export interface TranslateResponse {
  blocks: (TranslationBlock | null)[];
  error?: string;
}

export interface TtsResponse {
  dataUrl?: string;
  error?: string;
}

export interface ExplainResponse {
  headline?: string;
  translation?: string;
  error?: string;
}

export interface ModelCatalogEntry {
  id: string;
  name: string;
}

export interface ModelCatalogResponse {
  status: "ready" | "not-configured" | "failed";
  models: readonly ModelCatalogEntry[];
}

/**
 * A discriminated union of every message the background service worker
 * accepts. Each variant carries its own payload type.
 */
export type MlgMessage =
  | { type: "mlg:readerRun"; payload?: undefined }
  | { type: "mlg:getConfig"; payload?: undefined }
  | { type: "mlg:refreshModelCatalog"; payload?: undefined }
  | { type: "mlg:setConfig"; payload: SetConfigPayload }
  | { type: "mlg:getCacheStats"; payload?: undefined }
  | { type: "mlg:clearCache"; payload?: undefined }
  | { type: "mlg:normaDone"; payload: NormaDonePayload }
  | { type: "mlg:normaCheck"; payload: NormaCheckPayload }
  | { type: "mlg:openOutput"; payload: OpenOutputPayload }
  | { type: "mlg:openExplanation"; payload: OpenExplanationPayload }
  | { type: "mlg:getPendingExplanation"; payload?: undefined }
  | { type: "mlg:clearPendingExplanation"; payload?: undefined }
  | { type: "mlg:explainSentence"; payload: ExplainSentencePayload }
  | { type: "mlg:feedback"; payload: FeedbackPayload }
  | { type: "mlg:getVocab"; payload?: undefined }
  | { type: "mlg:addVocab"; payload: AddVocabPayload }
  | { type: "mlg:updateVocab"; payload: UpdateVocabPayload }
  | { type: "mlg:removeVocab"; payload: RemoveVocabPayload }
  | { type: "mlg:analyzeVocab"; payload: AnalyzeVocabPayload }
  | { type: "mlg:generateQuiz"; payload: GenerateQuizPayload }
  | { type: "mlg:tts"; payload: TtsPayload }
  | { type: "mlg:translate"; payload: TranslatePayload };

/** Track which message types broadcast to content scripts vs the side panel. */
export const BROADCAST_MSG = {
  normaDone: "mlg:normaDone" as const,
  openExplanation: "mlg:openExplanation" as const,
  openOutput: "mlg:openOutput" as const,
};
