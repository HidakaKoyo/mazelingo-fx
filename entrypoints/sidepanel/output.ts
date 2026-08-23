import { browser } from "wxt/browser";
import { elements } from "./el";
import { getTranslations } from "./translations";
import { switchTab } from "./ui";
import { generateQuiz as sendGenerateQuiz } from "./rpc";
import { resetFeedbackTts } from "./feedback";
import { formatTimer } from "./util";

export type OutputType = "paragraph" | "free" | "quiz";

let currentOutputMode: "opinion" | "rephrase" = "opinion";
let currentOutputType: OutputType = "paragraph";
let currentOutputOrigin = "";
let outputTimerInterval: ReturnType<typeof setInterval> | null = null;
let outputTimerStart: number | null = null;
let situationsData: { situation: string }[] | null = null;

export function getCurrentOutputMode(): "opinion" | "rephrase" {
  return currentOutputMode;
}

export function getCurrentOutputType(): OutputType {
  return currentOutputType;
}

export function getCurrentOutputOrigin(): string {
  return currentOutputOrigin;
}

export function setOutputMode(mode: "opinion" | "rephrase"): void {
  currentOutputMode = mode;
  elements.outputModeOpinion.checked = mode === "opinion";
  elements.outputModeRephrase.checked = mode === "rephrase";
  const t = getTranslations();
  elements.outputTextarea.placeholder =
    mode === "opinion" ? t.outputTextareaPlaceholderOpinion : t.outputTextareaPlaceholderRephrase;
}

function setParentDisplay(el: HTMLElement, value: string): void {
  const parent = el.parentElement;
  if (parent !== null) {
    parent.style.display = value;
  }
}

export function setOutputType(type: OutputType): void {
  currentOutputType = type;
  elements.outputTypeParagraph.classList.toggle("is-active", type === "paragraph");
  elements.outputTypeFree.classList.toggle("is-active", type === "free");
  elements.outputTypeQuiz.classList.toggle("is-active", type === "quiz");
  elements.quizPanel.style.display = "none";
  const t = getTranslations();
  if (type === "free") {
    elements.outputEmpty.style.display = "none";
    elements.outputForm.style.display = "";
    setParentDisplay(elements.outputSourceText, "none");
    setParentDisplay(elements.outputModeLabel, "none");
    elements.outputTextarea.placeholder = t.outputFreeEmptyTitle;
    elements.outputTextarea.value = "";
    elements.outputFeedbackSection.style.display = "none";
    elements.vocabSuggestSection.style.display = "none";
    startOutputTimer();
  } else if (type === "quiz") {
    elements.outputEmpty.style.display = "none";
    elements.outputForm.style.display = "";
    setParentDisplay(elements.outputSourceText, "none");
    setParentDisplay(elements.outputModeLabel, "none");
    elements.quizPanel.style.display = "";
    elements.outputTextarea.placeholder = t.outputFreeEmptyTitle;
    elements.outputTextarea.value = "";
    elements.outputFeedbackSection.style.display = "none";
    elements.vocabSuggestSection.style.display = "none";
    startOutputTimer();
    void generateQuiz();
  } else {
    setParentDisplay(elements.outputSourceText, "");
    setParentDisplay(elements.outputModeLabel, "");
    if (
      elements.outputSourceText.textContent === null ||
      elements.outputSourceText.textContent === ""
    ) {
      elements.outputForm.style.display = "none";
      elements.outputEmpty.style.display = "";
      elements.outputEmptyTitle.textContent = t.outputEmptyTitle;
      elements.outputEmptyDesc.textContent = t.outputEmptyDesc;
    }
  }
}

export function startOutputTimer(): void {
  stopOutputTimer();
  outputTimerStart = Date.now();
  elements.outputTimer.textContent = "0:00";
  outputTimerInterval = setInterval(() => {
    elements.outputTimer.textContent = formatTimer(Date.now() - (outputTimerStart ?? Date.now()));
  }, 1000);
}

function stopOutputTimer(): void {
  if (outputTimerInterval !== null) {
    clearInterval(outputTimerInterval);
    outputTimerInterval = null;
  }
}

export function resetOutputTimer(): void {
  outputTimerStart = Date.now();
  elements.outputTimer.textContent = "0:00";
}

export function showOutputForm(text: string, origin: string): void {
  resetFeedbackTts();
  currentOutputOrigin = origin || "";
  setOutputType("paragraph");
  switchTab("output");
  elements.outputEmpty.style.display = "none";
  setParentDisplay(elements.outputSourceText, "");
  setParentDisplay(elements.outputModeLabel, "");
  elements.outputForm.style.display = "";
  elements.outputSourceText.textContent = text;
  elements.outputTextarea.value = "";
  elements.outputFeedbackSection.style.display = "none";
  elements.outputFeedback.textContent = "";
  elements.vocabSuggestSection.style.display = "none";
  startOutputTimer();
  elements.outputTextarea.focus();
}

export async function loadSituations(): Promise<{ situation: string }[]> {
  if (situationsData !== null) {
    return situationsData;
  }
  const runtime: unknown = browser.runtime;
  const url = isUrlGetter(runtime) ? runtime.getURL("situations.json") : "";
  const resp = await fetch(url);
  const json: unknown = await resp.json();
  situationsData = isSituationArray(json) ? json : [];
  return situationsData;
}

function isUrlGetter(x: unknown): x is { getURL(path: string): string } {
  return typeof x === "object" && x !== null && "getURL" in x;
}

function isSituationArray(x: unknown): x is { situation: string }[] {
  return Array.isArray(x);
}

export async function generateQuiz(): Promise<void> {
  const t = getTranslations();
  elements.quizPrompt.textContent = t.quizLoading;
  elements.quizPrompt.classList.add("is-loading");
  elements.quizNextBtn.disabled = true;

  const situations = await loadSituations();
  const idx = Math.floor(Math.random() * situations.length);
  const picked = situations[idx];
  if (picked === undefined) {
    return;
  }
  elements.quizSituation.textContent = picked.situation;

  const res = await sendGenerateQuiz(picked.situation);

  elements.quizPrompt.classList.remove("is-loading");
  elements.quizNextBtn.disabled = false;

  if (res !== undefined && res.error === undefined) {
    elements.quizPrompt.textContent = res.prompt ?? "";
  } else {
    elements.quizPrompt.textContent = res?.error ?? "Error";
  }
}
