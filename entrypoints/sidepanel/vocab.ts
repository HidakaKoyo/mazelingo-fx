import type { VocabItem } from "@/utils/messages";
import { elements, escapeHtml } from "./el";
import { isClosest } from "./util";
import { getTranslations, type Translations } from "./translations";
import type { DeepReadonly } from "./util";
import {
  analyzeVocab as rpcAnalyze,
  addVocabRpc,
  getVocab,
  removeVocabRpc,
  updateVocab,
} from "./rpc";

const AUTO_ANALYZE_CONCURRENCY = 3;

let vocabItems: readonly VocabItem[] = [];
let vocabSortKey: "alpha" | "count" | "review" = "alpha";
let vocabSortAsc = true;
let lastMatchedVocab: string[] = [];
let autoAnalyzeRunning = false;
let autoAnalyzeAbort = false;
let autoAnalyzeGroup: string | null = null;
let openModalHandler: ((word: string) => void) | null = null;

export function setVocabOpenHandler(handler: (word: string) => void): void {
  openModalHandler = handler;
}
export function setVocabItems(items: readonly Readonly<VocabItem>[]): void {
  vocabItems = items;
}

export function getVocabItems(): readonly VocabItem[] {
  return vocabItems;
}

export function setLastMatchedVocab(items: readonly string[]): void {
  lastMatchedVocab = [...items];
}

export async function loadVocab(): Promise<void> {
  const resp = await getVocab();
  vocabItems = resp ?? [];
  renderVocabList();
}
export async function addVocab(en: string, ja: string): Promise<void> {
  const resp = await addVocabRpc(en, ja, en.includes(" ") ? "phrase" : "word");
  vocabItems = resp ?? vocabItems;
  renderVocabList();
}

export async function removeVocab(en: string): Promise<void> {
  const resp = await removeVocabRpc(en);
  vocabItems = resp ?? vocabItems;
  renderVocabList();
}

export function getFreqGroup(item: Readonly<VocabItem>): string {
  const f = item.frequency ?? "";
  if (f.includes("★★★★★")) {
    return "5";
  }
  if (f.includes("★★★★")) {
    return "4";
  }
  if (f.includes("★★★")) {
    return "3";
  }
  if (f.includes("★★")) {
    return "2";
  }
  if (f.includes("★")) {
    return "1";
  }
  return "unclassified";
}
async function analyzeItem(item: Readonly<VocabItem>): Promise<void> {
  elements.vocabList.querySelector(`[data-vocab-en="${item.en}"]`)?.classList.add("is-analyzing");
  const response = await rpcAnalyze(item.en);
  if (response === undefined || response.error !== undefined) {
    return;
  }
  const resp = await updateVocab(item.en, { analysis: response, frequency: response.frequency });
  if (resp === undefined) {
    return;
  }
  vocabItems = resp;
  renderVocabList();
}

function updateAutoAnalyzeBtn(): void {
  const btn = elements.vocabList.querySelector(
    `.vocab-auto-analyze-btn[data-group="${autoAnalyzeGroup}"]`,
  );
  if (btn === null) {
    return;
  }
  const remaining =
    autoAnalyzeGroup === "unclassified"
      ? vocabItems.filter((v: Readonly<VocabItem>) => getFreqGroup(v) === "unclassified").length
      : vocabItems.filter(
          (v: Readonly<VocabItem>) => getFreqGroup(v) === autoAnalyzeGroup && v.reanalyzed !== true,
        ).length;
  btn.textContent = `${getTranslations().vocabAutoAnalyzeStop} (${remaining})`;
}

function buildAnalyzeQueue(group: string): string[] {
  const targets = vocabItems.filter((v: Readonly<VocabItem>) => getFreqGroup(v) === group);
  if (group !== "unclassified") {
    targets.forEach((v) => {
      v.reanalyzed = false;
    });
  }
  return targets.map((v: Readonly<VocabItem>) => v.en);
}

export async function startAutoAnalyze(group: string): Promise<void> {
  if (autoAnalyzeRunning) {
    return;
  }
  autoAnalyzeRunning = true;
  autoAnalyzeAbort = false;
  autoAnalyzeGroup = group;
  renderVocabList();

  const queue = buildAnalyzeQueue(group);
  let idx = 0;
  const runNext = async (): Promise<void> => {
    if (autoAnalyzeAbort) {
      return;
    }
    const en = queue[idx++];
    if (en === undefined) {
      return;
    }
    const item = vocabItems.find((v: Readonly<VocabItem>) => v.en === en);
    if (item !== undefined) {
      updateAutoAnalyzeBtn();
      await analyzeItem(item);
      item.reanalyzed = true;
    }
    await runNext();
  };
  const workers = Array.from({ length: AUTO_ANALYZE_CONCURRENCY }, () => runNext());
  await Promise.all(workers);
  autoAnalyzeRunning = false;
  autoAnalyzeAbort = false;
  renderVocabList();
}

export function stopAutoAnalyze(): void {
  autoAnalyzeAbort = true;
  autoAnalyzeRunning = false;
  autoAnalyzeGroup = null;
  vocabItems.forEach((v) => {
    delete v.reanalyzed;
  });
  renderVocabList();
}

function groupVocabItems(searchQuery: string): Record<string, VocabItem[]> {
  const groups: Record<string, VocabItem[]> = {
    "1": [],
    "2": [],
    "3": [],
    "4": [],
    "5": [],
    unclassified: [],
  };
  vocabItems.forEach((item: Readonly<VocabItem>) => {
    if (searchQuery !== "" && !item.en.toLowerCase().includes(searchQuery)) {
      return;
    }
    const key = getFreqGroup(item);
    const arr = groups[key];
    if (arr !== undefined) {
      arr.push(item);
    }
  });
  const dir = vocabSortAsc ? 1 : -1;
  const sortFn = (a: Readonly<VocabItem>, b: Readonly<VocabItem>): number => {
    if (vocabSortKey === "count") {
      return (a.count - b.count) * dir || a.en.localeCompare(b.en);
    }
    if (vocabSortKey === "review") {
      return ((a.reviewCount ?? 0) - (b.reviewCount ?? 0)) * dir || a.en.localeCompare(b.en);
    }
    return a.en.localeCompare(b.en) * dir;
  };
  for (const g of Object.values(groups)) {
    const sorted = g.toSorted(sortFn);
    g.length = 0;
    g.push(...sorted);
  }
  return groups;
}

function sortArrow(key: string): string {
  return vocabSortKey === key ? (vocabSortAsc ? " ▲" : " ▼") : "";
}
function buildGroupHtml(
  t: Readonly<Translations>,
  key: string,
  label: string,
  desc: string,
  items: readonly DeepReadonly<VocabItem>[],
  matchedSet: ReadonlySet<string>,
): string {
  const infoIcon = desc
    ? `<span class="vocab-group-info" title="${escapeHtml(desc)}">i</span>`
    : "";
  const isUnclassified = key === "unclassified";
  const btnLabel =
    autoAnalyzeRunning && autoAnalyzeGroup === key
      ? t.vocabAutoAnalyzeStop
      : isUnclassified
        ? t.vocabAutoAnalyze
        : t.vocabReanalyzeGroup;
  let html = `<div class="vocab-group-header"><span class="vocab-group-label">${escapeHtml(label)}${infoIcon}</span><button class="vocab-auto-analyze-btn" data-group="${key}">${btnLabel}</button></div>`;
  for (const item of items) {
    const highlighted = matchedSet.has(item.en.toLowerCase()) ? " is-highlighted" : "";
    const zeroClass = item.count === 0 ? " is-zero" : "";
    const reviewZero = (item.reviewCount ?? 0) === 0 ? " is-zero" : "";
    html += `<div class="vocab-row${highlighted}" data-vocab-en="${escapeHtml(item.en)}">
      <span class="vocab-en">${escapeHtml(item.en)}</span>
      <span class="vocab-review${reviewZero}">${item.reviewCount ?? 0}</span>
      <span class="vocab-count${zeroClass}">${item.count}${t.vocabCount}</span>
      <button class="vocab-delete" data-en="${escapeHtml(item.en)}" title="Delete">&times;</button>
    </div>`;
  }
  return html;
}

function groupHeaderHtml(t: Readonly<Translations>): string {
  return `<div class="vocab-header-row"><span class="vocab-header-en vocab-header-sortable" data-sort="alpha">${escapeHtml(t.vocabHeaderWord)}${sortArrow("alpha")}</span><span class="vocab-header-review vocab-header-sortable" data-sort="review">${escapeHtml(t.vocabHeaderReview)}${sortArrow("review")}</span><span class="vocab-header-count vocab-header-sortable" data-sort="count">${escapeHtml(t.vocabHeaderCount)}${sortArrow("count")}</span></div>`;
}

export function renderVocabList(): void {
  const t = getTranslations();
  const searchQuery = (elements.vocabSearch?.value ?? "").trim().toLowerCase();
  const groups = groupVocabItems(searchQuery);
  const matchedSet = new Set(lastMatchedVocab.map((v) => v.toLowerCase()));
  const groupOrder = [
    { desc: t.freqDesc5, key: "5", label: "★★★★★" },
    { desc: t.freqDesc4, key: "4", label: "★★★★" },
    { desc: t.freqDesc3, key: "3", label: "★★★" },
    { desc: t.freqDesc2, key: "2", label: "★★" },
    { desc: t.freqDesc1, key: "1", label: "★" },
    { desc: "", key: "unclassified", label: t.vocabUnclassified },
  ];
  let html = groupHeaderHtml(t);
  for (const { key, label, desc } of groupOrder) {
    const items = groups[key];
    if (items === undefined || items.length === 0) {
      continue;
    }
    html += buildGroupHtml(t, key, label, desc, items, matchedSet);
  }
  elements.vocabList.innerHTML = html;
  bindVocabListHandlers();
}

function bindVocabListHandlers(): void {
  elements.vocabList.querySelectorAll<HTMLElement>(".vocab-row").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (isClosest(e.target, ".vocab-delete")) {
        return;
      }
      openModalHandler?.(row.dataset.vocabEn ?? "");
    });
  });
  elements.vocabList.querySelectorAll<HTMLElement>(".vocab-delete").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      void removeVocab(btn.dataset.en ?? "");
    });
  });
  elements.vocabList.querySelectorAll<HTMLElement>(".vocab-auto-analyze-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const group = btn.dataset.group;
      if (autoAnalyzeRunning) {
        stopAutoAnalyze();
      } else {
        void startAutoAnalyze(group ?? "unclassified");
      }
    });
  });
  elements.vocabList.querySelectorAll<HTMLElement>(".vocab-header-sortable").forEach((el) => {
    el.addEventListener("click", () => {
      const key = el.dataset.sort;
      if (vocabSortKey === key) {
        vocabSortAsc = !vocabSortAsc;
      } else {
        vocabSortKey = key === "count" ? "count" : key === "review" ? "review" : "alpha";
        vocabSortAsc = key === "alpha";
      }
      renderVocabList();
    });
  });
}
