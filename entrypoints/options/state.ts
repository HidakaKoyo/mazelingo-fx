import type { Config } from "@/utils/config";

export type SavedConfig = Readonly<Omit<Config, "models" | "apiKeys">> & {
  models: readonly string[];
  apiKeys: Readonly<Record<string, string>>;
};

export const SAVE_ANIMATION_DURATION_MS = 700;
export const SAVE_ANIMATION_INTERVAL_MS = 1500;

let currentLang: "ja" | "en" = "ja";
let currentPageMode: "optIn" | "optOut" = "optIn";
let defaultSaveLabel = "";
let savedState: SavedConfig | null = null;
let shakeIntervalId: ReturnType<typeof setInterval> | null = null;
let shakeTimeoutId: ReturnType<typeof setTimeout> | null = null;

export function getCurrentLang(): "ja" | "en" {
  return currentLang;
}

export function setCurrentLang(lang: "ja" | "en"): void {
  currentLang = lang;
}

export function getCurrentPageMode(): "optIn" | "optOut" {
  return currentPageMode;
}

export function setCurrentPageMode(mode: "optIn" | "optOut"): void {
  currentPageMode = mode;
}

export function getDefaultSaveLabel(): string {
  return defaultSaveLabel;
}

export function setDefaultSaveLabel(label: string): void {
  defaultSaveLabel = label;
}

export function getSavedState(): SavedConfig | null {
  return savedState;
}

export function setSavedState(state: Readonly<SavedConfig> | null): void {
  savedState = state;
}

export function getShakeIntervalId(): ReturnType<typeof setInterval> | null {
  return shakeIntervalId;
}

export function setShakeIntervalId(id: Readonly<ReturnType<typeof setInterval>> | null): void {
  shakeIntervalId = id;
}

export function getShakeTimeoutId(): ReturnType<typeof setTimeout> | null {
  return shakeTimeoutId;
}

export function setShakeTimeoutId(id: Readonly<ReturnType<typeof setTimeout>> | null): void {
  shakeTimeoutId = id;
}
