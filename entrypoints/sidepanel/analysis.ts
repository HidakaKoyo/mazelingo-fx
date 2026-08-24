import type { VocabAnalysis } from "@/utils/messages";
import { escapeHtml } from "./el";
import type { Translations } from "./translations";
import type { DeepReadonly } from "./util";

function freqClass(f: string): string {
  if (f.includes("★★★★★") || f.includes("★★★★")) {
    return "freq-high";
  }
  if (f.includes("★★★")) {
    return "freq-mid";
  }
  return "freq-low";
}

function diffClass(d: string): string {
  if (d.includes("初級") || d.toLowerCase().includes("easy")) {
    return "diff-easy";
  }
  if (d.includes("上級") || d.toLowerCase().includes("hard")) {
    return "diff-hard";
  }
  return "diff-mid";
}

export function isVocabAnalysis(value: unknown): value is VocabAnalysis {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return "frequency" in value && typeof value.frequency === "string";
}

function exampleRows(items: readonly { readonly en: string; readonly ja: string }[]): string {
  return items
    .map(
      (ex) =>
        `<div class="modal-example"><div class="modal-example-row"><div class="modal-example-en">${escapeHtml(ex.en)}</div><button class="modal-tts-btn" data-text="${escapeHtml(ex.en)}" title="再生">&#9655;</button></div><div class="modal-example-ja">${escapeHtml(ex.ja)}</div></div>`,
    )
    .join("");
}

function tagList(words: readonly string[]): string {
  return words.map((w) => `<span class="modal-tag">${escapeHtml(w)}</span>`).join("");
}

function buildVisualSection(encoded: string, t: Readonly<Translations>): string {
  return `<div class="modal-section">
    <div class="modal-section-title">${escapeHtml(t.modalVisual)}</div>
    <div class="modal-visual-item"><div class="modal-visual-label">${escapeHtml(t.modalImage)}</div><a class="modal-link" href="https://www.google.co.jp/search?q=${encoded}&hl=en&tbm=isch" target="_blank" rel="noopener">Google Images ↗</a></div>
    <div class="modal-visual-item"><div class="modal-visual-label">${escapeHtml(t.modalYoutube)}</div><a class="modal-link" href="https://youglish.com/pronounce/${encoded}/english" target="_blank" rel="noopener">YouGlish ↗</a></div>
    <div class="modal-visual-item"><div class="modal-visual-label">${escapeHtml(t.modalMovie)}</div><a class="modal-link" href="https://www.playphrase.me/#/search?q=${encoded}" target="_blank" rel="noopener">PlayPhrase.me ↗</a></div>
  </div>`;
}

function buildRelatedSection(data: DeepReadonly<VocabAnalysis>, t: Readonly<Translations>): string {
  return `<div class="modal-section">
    <div class="modal-section-title">${escapeHtml(t.modalRelated)}</div>
    <div class="modal-field"><div class="modal-field-label">${escapeHtml(t.modalSynonyms)}</div><div class="modal-tags">${tagList(data.relatedWords.synonyms ?? [])}</div></div>
    <div class="modal-field"><div class="modal-field-label">${escapeHtml(t.modalAntonyms)}</div><div class="modal-tags">${tagList(data.relatedWords.antonyms ?? [])}</div></div>
    <div class="modal-field"><div class="modal-field-label">${escapeHtml(t.modalDerivatives)}</div><div class="modal-tags">${tagList(data.relatedWords.derivatives ?? [])}</div></div>
  </div>`;
}

export function buildAnalysisHtml(
  data: DeepReadonly<VocabAnalysis>,
  word: string,
  t: Readonly<Translations>,
): string {
  const encoded = encodeURIComponent(word);
  let html = "";

  html += `<div class="modal-section">
    <div class="modal-section-title">${escapeHtml(t.modalMeaning)}</div>
    <div class="modal-example"><div class="modal-field-label">${escapeHtml(t.modalDefinition)}</div><div class="modal-field-value">${escapeHtml(data.meaning.definition)}</div></div>
    <div class="modal-example"><div class="modal-field-label">${escapeHtml(t.modalCoreImage)}</div><div class="modal-field-value">${escapeHtml(data.meaning.coreImage)}</div></div>
    <div class="modal-example"><div class="modal-field-label">${escapeHtml(t.modalNativeFeel)}</div><div class="modal-field-value">${escapeHtml(data.meaning.nativeFeel)}</div></div>
    <div class="modal-example"><div class="modal-field-label">${escapeHtml(t.modalUsageScene)}</div><div class="modal-field-value">${escapeHtml(data.meaning.usageScene)}</div></div>
  </div>`;

  html += `<div class="modal-section">
    <div class="modal-field"><div class="modal-field-label">${escapeHtml(t.modalFrequency)}</div><div class="modal-field-value"><span class="modal-badge ${freqClass(data.frequency)}">${escapeHtml(data.frequency)}</span></div></div>
    <div class="modal-field"><div class="modal-field-label">${escapeHtml(t.modalDifficulty)}</div><div class="modal-field-value"><span class="modal-badge ${diffClass(data.difficulty)}">${escapeHtml(data.difficulty)}</span></div></div>
  </div>`;

  html += `<div class="modal-section">
    <div class="modal-section-title">${escapeHtml(t.modalEtymology)}</div>
    <div class="modal-field-value">${escapeHtml(data.etymology)}</div>
  </div>`;

  html += `<div class="modal-section">
    <div class="modal-section-title">${escapeHtml(t.modalPronunciation)}</div>
    <div class="modal-field"><div class="modal-field-label">${escapeHtml(t.modalIpa)}</div><div class="modal-field-value">${escapeHtml(data.pronunciation.ipa)}</div></div>
    <div class="modal-field"><a class="modal-link" href="${escapeHtml(data.pronunciation.googleTranslateUrl)}" target="_blank" rel="noopener">${escapeHtml(t.modalListen)} (Google Translate) ↗</a></div>
  </div>`;

  html += `<div class="modal-section">
    <div class="modal-section-title">${escapeHtml(t.modalExamples)}</div>
    ${exampleRows(data.examples ?? [])}
  </div>`;

  html += `<div class="modal-section">
    <div class="modal-section-title">${escapeHtml(t.modalCollocations)}</div>
    ${exampleRows(data.collocations ?? [])}
  </div>`;

  html += buildVisualSection(encoded, t);
  html += buildRelatedSection(data, t);

  return html;
}
