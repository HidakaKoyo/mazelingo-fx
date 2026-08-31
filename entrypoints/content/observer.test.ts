// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const observerMocks = vi.hoisted(() => ({
  cancelReaderForUrlChange: vi.fn(),
  hideTooltip: vi.fn(),
  processRoot: vi.fn(),
  refreshDisplay: vi.fn(),
  renderSpanDisplay: vi.fn(),
  resumeUntranslatedBlocks: vi.fn(),
  startIntersectionObserver: vi.fn(),
}));

vi.mock("wxt/browser", () => ({
  browser: {
    runtime: { sendMessage: vi.fn() },
    storage: { local: { get: vi.fn() } },
  },
}));
vi.mock("./blocks", () => ({
  resumeUntranslatedBlocks: observerMocks.resumeUntranslatedBlocks,
  startIntersectionObserver: observerMocks.startIntersectionObserver,
}));
vi.mock("./reader", () => ({ cancelReaderForUrlChange: observerMocks.cancelReaderForUrlChange }));
vi.mock("./root", () => ({
  processRoot: observerMocks.processRoot,
  refreshDisplay: observerMocks.refreshDisplay,
}));
vi.mock("./text", () => ({ renderSpanDisplay: observerMocks.renderSpanDisplay }));
vi.mock("./tooltip", () => ({ hideTooltip: observerMocks.hideTooltip }));

import {
  evaluatePageForCurrentUrl,
  resetReusableBlocksForUrlChange,
  resumeAutomaticTranslation,
  stopObserver,
} from "./observer";
import { STATE, updatePageMatchers } from "./state";
import type { PendingBlock } from "./state";

class FakeMutationObserver {
  disconnect(): void {}
  observe(): void {}
}

let initialHref = "";

function resetObserverTestState(): void {
  initialHref = location.href;
  vi.stubGlobal("MutationObserver", FakeMutationObserver);
  STATE.blockTranslateTimer = null;
  STATE.config.enabled = true;
  STATE.config.pageListInclude = "*";
  STATE.config.pageListExclude = "";
  STATE.intersectionObserver = null;
  STATE.mode = "auto";
  STATE.observer = null;
  STATE.pendingBlocks = [];
  STATE.runHref = "";
  STATE.runId = 0;
  STATE.started = false;
  updatePageMatchers();
  document.body.replaceChildren();
}

function cleanUpObserverTestState(): void {
  stopObserver();
  STATE.intersectionObserver = null;
  STATE.pendingBlocks = [];
  Object.values(observerMocks).forEach((mock) => {
    mock.mockReset();
  });
  window.history.replaceState({}, "", initialHref);
  vi.unstubAllGlobals();
}

function createPendingBlock(): PendingBlock {
  return {
    atoms: new Map(),
    element: document.createElement("p"),
    href: location.href,
    htmlParts: ["Pending block"],
    lang: "en",
    mode: "auto",
    runId: STATE.runId,
    separators: [],
  };
}

beforeEach(() => {
  resetObserverTestState();
});

afterEach(() => {
  cleanUpObserverTestState();
});

it("does not invalidate an initial automatic run when the URL has not changed", () => {
  resumeAutomaticTranslation();
  const runId = STATE.runId;

  evaluatePageForCurrentUrl();

  expect(STATE.runId).toBe(runId);
  expect(observerMocks.resumeUntranslatedBlocks).toHaveBeenCalledTimes(1);
});

it("drops old pending blocks before restarting automatic translation after an SPA URL change", () => {
  resumeAutomaticTranslation();
  const oldRunId = STATE.runId;
  STATE.pendingBlocks = [createPendingBlock()];
  const reusedBlock = document.createElement("p");
  reusedBlock.dataset.mlgBlock = "1";
  reusedBlock.dataset.mlgBound = "1";
  reusedBlock.dataset.mlgFailed = "1";
  document.body.append(reusedBlock);
  window.history.pushState({}, "", "/next-page");

  evaluatePageForCurrentUrl();

  expect(STATE.pendingBlocks).toEqual([]);
  expect(STATE.runHref).toBe(location.href);
  expect(STATE.runId).toBeGreaterThan(oldRunId);
  expect(reusedBlock.dataset.mlgBlock).toBeUndefined();
  expect(reusedBlock.dataset.mlgBound).toBe("1");
  expect(reusedBlock.dataset.mlgFailed).toBeUndefined();
  expect(observerMocks.resumeUntranslatedBlocks).toHaveBeenCalledTimes(2);
});

it("releases only raw reused blocks for fresh discovery", () => {
  const rawBlock = document.createElement("p");
  rawBlock.dataset.mlgBlock = "1";
  rawBlock.dataset.mlgBound = "1";
  const translatedBlock = document.createElement("p");
  translatedBlock.dataset.mlgBlock = "1";
  const translatedSentence = document.createElement("span");
  translatedSentence.dataset.mlgSentence = "1";
  translatedBlock.append(translatedSentence);
  document.body.append(rawBlock, translatedBlock);

  resetReusableBlocksForUrlChange();

  expect(rawBlock.dataset.mlgBlock).toBeUndefined();
  expect(rawBlock.dataset.mlgBound).toBe("1");
  expect(translatedBlock.dataset.mlgBlock).toBe("1");
});
