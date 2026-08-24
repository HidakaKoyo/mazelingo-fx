import { resolveProvider } from "@/utils/llm";
import { elements } from "./el";

export type DeepReadonly<T> = T extends readonly (infer R)[]
  ? readonly DeepReadonly<R>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

export function isClosest(target: EventTarget | null, selector: string): boolean {
  return target instanceof Element && target.closest(selector) !== null;
}

export function selectedTtsVoice(): string {
  return elements.ttsVoice.value === "" ? "nova" : elements.ttsVoice.value;
}

export function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortObject(item));
  }
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value).toSorted(
      ([a]: readonly [string, unknown], [b]: readonly [string, unknown]) => a.localeCompare(b),
    )) {
      sorted[key] = sortObject(val);
    }
    return sorted;
  }
  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortObject(value)) ?? "";
}

export function getProviderPrefix(modelName: string): string | null {
  return resolveProvider(modelName)?.prefix ?? null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTimer(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
