import { browser } from "wxt/browser";
import type { Config } from "@/utils/config";
import { DEFAULT_CONFIG, mergeConfig } from "@/utils/config";
import { STORAGE_KEY } from "@/utils/keys";
import { elements } from "./el";
import { selectedTtsVoice } from "./util";
import {
  collectApiKeys,
  getApiKeySaveValidationMessage,
  getSelectedModels,
  hasUnconfirmedApiKey,
} from "./model";
import { getTranslations } from "./translations";
import { SAVE_ANIMATION_DURATION_MS, SAVE_ANIMATION_INTERVAL_MS } from "./constants";
import { formatBytes, stableStringify, type DeepReadonly } from "./util";
import { clearCacheRpc, getCacheStatsRpc } from "./rpc";
import { getChangedCatalogProviders, type CatalogProviderId } from "./model-catalog-refresh";

let defaultSaveLabel = "";
let savedState: DeepReadonly<Config> | null = null;
let shakeIntervalId: ReturnType<typeof setInterval> | null = null;
let shakeTimeoutId: ReturnType<typeof setTimeout> | null = null;

export interface SaveConfigResult {
  readonly saved: boolean;
  readonly changedCatalogProviders: readonly CatalogProviderId[];
}

export function setDefaultSaveLabel(label: string): void {
  defaultSaveLabel = label;
}

export function getDefaultSaveLabel(): string {
  return defaultSaveLabel;
}

function parseRatioInput(input: HTMLInputElement, fallback: number): number {
  const raw = input.value;
  if (raw === "") {
    return fallback;
  }
  const n = Number(raw);
  return Number.isNaN(n) ? fallback : n;
}

export function collectFormState(): Config {
  return {
    apiKeys: collectApiKeys(),
    enabled: elements.enabled.checked,
    englishRatio: parseRatioInput(elements.englishRatio, 0),
    minTextLength: parseRatioInput(elements.minTextLength, DEFAULT_CONFIG.minTextLength),
    mixLanguage: elements.mixLanguage.checked,
    models: getSelectedModels(),
    outputRatio: parseRatioInput(elements.outputRatio, 0),
    pageListExclude: elements.pageListExclude.value,
    pageListInclude: elements.pageListInclude.value,
    translateButtons: elements.translateButtons.checked,
    ttsVoice: selectedTtsVoice(),
  };
}

function hasUnsavedChanges(): boolean {
  return savedState !== null && stableStringify(collectFormState()) !== stableStringify(savedState);
}

function triggerSaveAnimation(): void {
  elements.save.classList.add("is-shaking");
  if (shakeTimeoutId !== null) {
    clearTimeout(shakeTimeoutId);
  }
  shakeTimeoutId = setTimeout(() => {
    elements.save.classList.remove("is-shaking");
  }, SAVE_ANIMATION_DURATION_MS);
}

function setSaveAnimation(active: boolean): void {
  if (active) {
    if (shakeIntervalId !== null) {
      return;
    }
    triggerSaveAnimation();
    shakeIntervalId = setInterval(triggerSaveAnimation, SAVE_ANIMATION_INTERVAL_MS);
    return;
  }
  if (shakeIntervalId !== null) {
    clearInterval(shakeIntervalId);
    shakeIntervalId = null;
  }
  if (shakeTimeoutId !== null) {
    clearTimeout(shakeTimeoutId);
    shakeTimeoutId = null;
  }
  elements.save.classList.remove("is-shaking");
}

export function updateDirtyState(): void {
  if (savedState === null) {
    return;
  }
  setSaveAnimation(hasUnsavedChanges());
}

export function setSavedState(state: DeepReadonly<Config>): void {
  savedState = state;
  updateDirtyState();
}

export function stepRange(input: HTMLInputElement, delta: number, callback: () => void): void {
  const step = Number(input.step) || 1;
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 100;
  input.value = String(Math.max(min, Math.min(max, Number(input.value) + delta * step)));
  callback();
}

function isConfig(x: unknown): x is Config {
  return typeof x === "object" && x !== null && "models" in x;
}

export async function loadConfig(): Promise<Config> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const raw: unknown = result[STORAGE_KEY];
  return mergeConfig(isConfig(raw) ? raw : undefined);
}

export async function saveConfig(): Promise<SaveConfigResult> {
  if (hasUnconfirmedApiKey()) {
    elements.modelCatalogStatus.textContent = getApiKeySaveValidationMessage();
    return { changedCatalogProviders: [], saved: false };
  }
  const state = collectFormState();
  const changedCatalogProviders = getChangedCatalogProviders(savedState, state);
  await browser.storage.local.set({ [STORAGE_KEY]: state });
  setSavedState(state);
  const t = getTranslations();
  elements.save.textContent = t.saved;
  setTimeout(() => {
    elements.save.textContent = getDefaultSaveLabel();
  }, 1200);
  return { changedCatalogProviders, saved: true };
}

export async function refreshCacheStats(): Promise<void> {
  const t = getTranslations();
  const stats = await getCacheStatsRpc();
  elements.cacheStats.textContent = t.cacheStats(
    stats?.entries ?? 0,
    formatBytes(stats?.bytes ?? 0),
  );
}

export async function clearCache(): Promise<void> {
  const t = getTranslations();
  elements.clearCache.disabled = true;
  await clearCacheRpc();
  await refreshCacheStats();
  elements.clearCache.textContent = t.cacheCleared;
  setTimeout(() => {
    elements.clearCache.textContent = getTranslations().cacheClear;
    elements.clearCache.disabled = false;
  }, 1200);
}

export function updateRatioLabel(): void {
  const value = parseRatioInput(elements.englishRatio, 0);
  elements.ratioFill.style.width = `${value}%`;
  elements.ratioEnValue.textContent = `${value}%`;
  elements.ratioJaValue.textContent = `${100 - value}%`;
  updateDirtyState();
}

export function updateOutputRatioLabel(): void {
  const value = parseRatioInput(elements.outputRatio, 0);
  elements.outputRatioFill.style.width = `${value}%`;
  elements.outputRatioValue.textContent = `${value}%`;
  updateDirtyState();
}
