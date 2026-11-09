import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addClass: vi.fn(),
  autoTranslate: { checked: true },
  removeClass: vi.fn(),
}));

vi.mock("wxt/browser", () => ({ browser: { storage: { local: { get: vi.fn(), set: vi.fn() } } } }));
vi.mock("./el", () => ({
  elements: {
    autoTranslate: mocks.autoTranslate,
    enabled: { checked: true },
    englishRatio: { value: "30" },
    localApiKey: { value: "" },
    localBaseUrl: { value: "http://localhost:1234/v1" },
    localMode: { value: "plamo" },
    localModelId: { value: "local-model" },
    minTextLength: { value: "5" },
    mixLanguage: { checked: true },
    modelCatalogStatus: { textContent: "" },
    outputRatio: { value: "20" },
    pageListExclude: { value: "https://example.com/private/*" },
    pageListInclude: { value: "https://example.com/*" },
    save: { classList: { add: mocks.addClass, remove: mocks.removeClass }, textContent: "" },
    translateButtons: { checked: false },
    translationUse: { value: "api" },
  },
}));
vi.mock("./model", () => ({
  collectApiKeys: (): Record<string, string> => ({}),
  getApiKeySaveValidationMessage: (): string => "",
  getSelectedModels: (): string[] => [],
  hasUnconfirmedApiKey: (): boolean => false,
}));
vi.mock("./util", () => ({
  formatBytes: (): string => "0 B",
  selectedTtsVoice: (): string => "nova",
  stableStringify: (value: unknown): string => JSON.stringify(value),
}));
vi.mock("./translations", () => ({
  getTranslations: (): { saved: string } => ({ saved: "Saved" }),
}));
vi.mock("./rpc", () => ({ clearCacheRpc: vi.fn(), getCacheStatsRpc: vi.fn() }));
vi.mock("./model-catalog-refresh", () => ({
  getChangedCatalogProviders: (): never[] => [],
}));

import { collectFormState, setSavedState, updateDirtyState } from "./config";

beforeEach(() => {
  vi.useFakeTimers();
  mocks.addClass.mockReset();
  mocks.removeClass.mockReset();
  mocks.autoTranslate.checked = true;
});

afterEach(() => {
  setSavedState(collectFormState());
  vi.useRealTimers();
});

it("collects automatic translation and includes it in the dirty check", () => {
  setSavedState(collectFormState());
  mocks.addClass.mockReset();

  mocks.autoTranslate.checked = false;
  updateDirtyState();

  expect(collectFormState().autoTranslate).toBe(false);
  expect(mocks.addClass).toHaveBeenCalledWith("is-shaking");
});
