/**
 * Vocab list storage helpers. Vocabulary persistence is delegated to an
 * injected backend so tests can use an in-memory fake.
 */
import { VOCAB_STORAGE_KEY } from "./keys";
import type { VocabItem } from "./messages";

export interface VocabBackend {
  get(key: string): Promise<Record<string, unknown>>;
  set(item: Readonly<Record<string, unknown>>): Promise<void>;
  getURL(path: string): string;
  fetch(url: string): Promise<{ json(): Promise<Omit<VocabItem, "count">[]> }>;
}

export interface VocabStore {
  load(): Promise<VocabItem[] | null>;
  save(items: readonly Readonly<VocabItem>[]): Promise<void>;
  initIfNeeded(): Promise<VocabItem[]>;
}

function isVocabBox(value: unknown): value is { items?: VocabItem[] } {
  return typeof value === "object" && value !== null && "items" in value;
}

export function createVocabStore(backend: Readonly<VocabBackend>): VocabStore {
  async function load(): Promise<VocabItem[] | null> {
    const result = await backend.get(VOCAB_STORAGE_KEY);
    const stored = result[VOCAB_STORAGE_KEY];
    const box = isVocabBox(stored) ? stored : undefined;
    return box?.items ?? null;
  }

  async function save(items: readonly Readonly<VocabItem>[]): Promise<void> {
    await backend.set({ [VOCAB_STORAGE_KEY]: { items } });
  }

  async function initIfNeeded(): Promise<VocabItem[]> {
    const existing = await load();
    if (existing) {
      return existing;
    }
    const url = backend.getURL("vocab_data.json");
    const resp = await backend.fetch(url);
    const data = await resp.json();
    const items: VocabItem[] = data.map((v) => ({ ...v, count: 0 }));
    await save(items);
    return items;
  }

  return { initIfNeeded, load, save };
}

export function matchVocabInText(
  text: string,
  vocabItems: readonly Readonly<VocabItem>[],
): string[] {
  const lower = text.toLowerCase(),
    matched: string[] = [];
  for (const item of vocabItems) {
    const pattern = item.en.toLowerCase(),
      regex = new RegExp(
        `\\b${pattern.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`)}\\b`,
        "iu",
      );
    if (regex.test(lower)) {
      matched.push(item.en);
    }
  }
  return matched;
}

export function normalizeVocab(str: string): string {
  return str
    .toLowerCase()
    .replaceAll(/\s*~\s*/gu, "")
    .replaceAll(/\s+/gu, " ")
    .trim();
}
