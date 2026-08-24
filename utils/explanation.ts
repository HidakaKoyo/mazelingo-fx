/**
 * Pending sentence-explanation handoff between the content script (which
 * captures the sentence) and the side panel (which shows the explanation).
 * Stored in chrome.storage.local so it survives the side panel opening.
 */
import { PENDING_EXPLANATION_KEY } from "./keys";
import type { OpenExplanationPayload } from "./messages";

export interface ExplanationBackend {
  get(key: Readonly<string>): Promise<Record<string, unknown>>;
  set(item: Readonly<Record<string, unknown>>): Promise<void>;
  remove(key: Readonly<string>): Promise<void>;
}

export function createExplanationStore(backend: Readonly<ExplanationBackend>): {
  set: (request: Readonly<OpenExplanationPayload & { requestedAt: number }>) => Promise<void>;
  get: () => Promise<OpenExplanationPayload | null>;
  clear: () => Promise<void>;
} {
  async function set(
    request: Readonly<OpenExplanationPayload & { requestedAt: number }>,
  ): Promise<void> {
    await backend.set({ [PENDING_EXPLANATION_KEY]: request });
  }

  /** Read and remove the pending request in one go (consume-once). */
  async function get(): Promise<OpenExplanationPayload | null> {
    const result = await backend.get(PENDING_EXPLANATION_KEY);
    const stored = result[PENDING_EXPLANATION_KEY];
    const request = isOpenExplanationPayload(stored) ? stored : null;
    await backend.remove(PENDING_EXPLANATION_KEY);
    return request;
  }

  async function clear(): Promise<void> {
    await backend.remove(PENDING_EXPLANATION_KEY);
  }

  return { clear, get, set };
}

function isOpenExplanationPayload(value: unknown): value is OpenExplanationPayload {
  return typeof value === "object" && value !== null;
}
