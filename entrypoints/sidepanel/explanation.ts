import type {
  ExplanationChunk,
  ExplanationResult,
  GrammarPoint,
  OpenExplanationPayload,
} from "@/utils/messages";
import { elements, escapeHtml } from "./el";
import { getTranslations, type Translations } from "./translations";
import type { DeepReadonly } from "./util";
import { switchTab } from "./ui";
import { clearPendingExplanation, explainSentence } from "./rpc";

let currentExplanationToken: string | null = null;

function buildChunksHtml(
  chunks: readonly DeepReadonly<ExplanationChunk>[],
  t: Readonly<Translations>,
): string {
  let html = `<div class="explanation-card"><div class="explanation-card-title">${escapeHtml(t.explanationChunks)}</div>`;
  for (const chunk of chunks) {
    html += `<div class="explanation-chunk">`;
    html += `<div><span class="explanation-chunk-text">${escapeHtml(chunk.text)}</span><span class="explanation-chunk-role">${escapeHtml(chunk.role)}</span></div>`;
    html += `<div>${escapeHtml(chunk.explanation)}</div>`;
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

function buildGrammarHtml(
  grammarPoints: readonly DeepReadonly<GrammarPoint>[],
  t: Readonly<Translations>,
): string {
  let html = `<div class="explanation-card"><div class="explanation-card-title">${escapeHtml(t.explanationGrammar)}</div><ul class="explanation-list">`;
  for (const item of grammarPoints) {
    html += `<li><strong>${escapeHtml(item.title)}</strong>: ${escapeHtml(item.explanation)}</li>`;
  }
  html += `</ul></div>`;
  return html;
}

function buildVocabularyHtml(
  vocabulary: readonly {
    readonly term: string;
    readonly meaning: string;
    readonly nuance: string;
  }[],
  t: Readonly<Translations>,
): string {
  let html = `<div class="explanation-card"><div class="explanation-card-title">${escapeHtml(t.explanationVocabulary)}</div><ul class="explanation-list">`;
  for (const item of vocabulary) {
    html += `<li><strong>${escapeHtml(item.term)}</strong>: ${escapeHtml(item.meaning)}<br>${escapeHtml(item.nuance)}</li>`;
  }
  html += `</ul></div>`;
  return html;
}

function buildStepsHtml(readingSteps: readonly string[], t: Readonly<Translations>): string {
  let html = `<div class="explanation-card"><div class="explanation-card-title">${escapeHtml(t.explanationSteps)}</div><ol class="explanation-list">`;
  for (const step of readingSteps) {
    html += `<li>${escapeHtml(step)}</li>`;
  }
  html += `</ol></div>`;
  return html;
}

function buildExplanationHtml(result: DeepReadonly<ExplanationResult>): string {
  const t = getTranslations();
  const chunks = result.chunks ?? [];
  const grammarPoints = result.grammarPoints ?? [];
  const vocabulary = result.vocabulary ?? [];
  const readingSteps = result.readingSteps ?? [];
  let html = "";

  html += `<div class="explanation-card">`;
  if (result.headline !== undefined && result.headline !== "") {
    html += `<div class="explanation-headline">${escapeHtml(result.headline)}</div>`;
  }
  if (result.translation !== undefined && result.translation !== "") {
    html += `<div>${escapeHtml(result.translation)}</div>`;
  }
  if (result.overview !== undefined && result.overview !== "") {
    html += `<div style="margin-top:8px;">${escapeHtml(result.overview)}</div>`;
  }
  html += `</div>`;

  if (chunks.length > 0) {
    html += buildChunksHtml(chunks, t);
  }
  if (grammarPoints.length > 0) {
    html += buildGrammarHtml(grammarPoints, t);
  }
  if (vocabulary.length > 0) {
    html += buildVocabularyHtml(vocabulary, t);
  }
  if (readingSteps.length > 0) {
    html += buildStepsHtml(readingSteps, t);
  }
  return html;
}

export function renderExplanation(result: DeepReadonly<ExplanationResult>): void {
  elements.explanationResult.innerHTML = buildExplanationHtml(result);
}

export async function showExplanation(payload: Readonly<OpenExplanationPayload>): Promise<void> {
  const text = (payload.text ?? payload.englishText ?? "").trim();
  if (text === "") {
    return;
  }

  const t = getTranslations();
  const token = `${Date.now()}-${Math.random()}`;
  currentExplanationToken = token;

  switchTab("explanation");
  elements.explanationSourceSection.style.display = "";
  elements.explanationSourceText.textContent = text;

  const japaneseText = (payload.japaneseText ?? "").trim();
  if (japaneseText !== "" && japaneseText !== text) {
    elements.explanationTranslationText.style.display = "";
    elements.explanationTranslationText.textContent = `${t.explanationTranslationLabel}: ${japaneseText}`;
  } else {
    elements.explanationTranslationText.style.display = "none";
    elements.explanationTranslationText.textContent = "";
  }

  elements.explanationEmpty.style.display = "none";
  elements.explanationResult.style.display = "";
  elements.explanationResult.innerHTML = `<div class="feedback-loading">${escapeHtml(t.explanationLoading)}</div>`;
  void clearPendingExplanation();

  const response = await explainSentence(payload);
  if (currentExplanationToken !== token) {
    return;
  }

  if (response === undefined || response.error !== undefined) {
    elements.explanationResult.innerHTML = `<div class="feedback-error">${escapeHtml(response?.error ?? t.explanationError)}</div>`;
    return;
  }
  renderExplanation(response);
}
