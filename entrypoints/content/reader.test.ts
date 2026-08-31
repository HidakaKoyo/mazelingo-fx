// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const browserMocks = vi.hoisted(() => ({ sendMessage: vi.fn() }));

vi.mock("wxt/browser", () => ({
  browser: {
    runtime: { sendMessage: browserMocks.sendMessage },
    storage: { local: { get: vi.fn() } },
  },
}));

import { stop } from "./observer";
import { cancelReaderMode, startReaderMode } from "./reader";
import { STATE, updatePageMatchers } from "./state";
import type { MlgTranslateResponse } from "./state";

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function translation(source: string): MlgTranslateResponse {
  return { blocks: [{ sentences: [{ source, translation: `訳:${source}` }] }] };
}

class FakeIntersectionObserver {
  disconnect(): void {}
  observe(): void {}
  unobserve(): void {}
}

function resetReaderTestState(): void {
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  document.body.replaceChildren();
  STATE.config.enabled = true;
  STATE.config.models = ["openrouter/deepseek/deepseek-chat"];
  STATE.config.minTextLength = 1;
  STATE.config.pageListInclude = "*";
  STATE.config.pageListExclude = "";
  STATE.mode = "auto";
  STATE.runId = 0;
  STATE.runHref = "";
  STATE.displayOverride = null;
  STATE.pendingBlocks = [];
  STATE.started = false;
  STATE.intersectionObserver = null;
  STATE.observer = null;
  updatePageMatchers();
}

function cleanUpReaderTestState(): void {
  STATE.config.enabled = false;
  cancelReaderMode();
  browserMocks.sendMessage.mockReset();
  vi.unstubAllGlobals();
}

beforeEach(() => {
  resetReaderTestState();
});

afterEach(() => {
  cleanUpReaderTestState();
});

it("sends document blocks one at a time in order", async () => {
  const first = document.createElement("p");
  first.textContent = "First sentence";
  const second = document.createElement("p");
  second.textContent = "Second sentence";
  document.body.append(first, second);
  const firstResponse = deferred<MlgTranslateResponse>();
  const secondResponse = deferred<MlgTranslateResponse>();
  browserMocks.sendMessage
    .mockReturnValueOnce(firstResponse.promise)
    .mockReturnValueOnce(secondResponse.promise);

  startReaderMode();
  expect(browserMocks.sendMessage).toHaveBeenCalledTimes(1);
  expect(browserMocks.sendMessage.mock.calls[0]?.[0]).toMatchObject({
    payload: { htmlBlocks: ["First sentence"] },
  });

  firstResponse.resolve(translation("First sentence"));
  await vi.waitFor(() => {
    expect(browserMocks.sendMessage).toHaveBeenCalledTimes(2);
  });
  expect(browserMocks.sendMessage.mock.calls[1]?.[0]).toMatchObject({
    payload: { htmlBlocks: ["Second sentence"] },
  });
  secondResponse.resolve(translation("Second sentence"));
});

it("does not apply an in-flight response after cancellation", async () => {
  const block = document.createElement("p");
  block.textContent = "Stale sentence";
  document.body.append(block);
  const response = deferred<MlgTranslateResponse>();
  browserMocks.sendMessage.mockReturnValue(response.promise);

  startReaderMode();
  cancelReaderMode();
  response.resolve(translation("Stale sentence"));
  await vi.waitFor(() => {
    expect(block.querySelector("[data-mlg-sentence]")).toBeNull();
  });
});

it("does not persist display settings while overriding reader display", () => {
  const ratio = STATE.config.englishRatio;
  const mix = STATE.config.mixLanguage;
  const block = document.createElement("p");
  block.textContent = "Display settings stay unchanged";
  document.body.append(block);
  browserMocks.sendMessage.mockReturnValue(new Promise(() => {}));

  startReaderMode();

  expect(STATE.displayOverride).toBe("ja");
  expect(STATE.config.englishRatio).toBe(ratio);
  expect(STATE.config.mixLanguage).toBe(mix);
});

it("clears the temporary display override when automatic translation stops", () => {
  STATE.displayOverride = "ja";
  STATE.started = true;

  stop();

  expect(STATE.displayOverride).toBeNull();
  expect(STATE.mode).toBe("auto");
});
