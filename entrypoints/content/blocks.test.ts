// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const browserMocks = vi.hoisted(() => ({
  sendMessage: vi.fn(),
}));

vi.mock("wxt/browser", () => ({
  browser: {
    runtime: { sendMessage: browserMocks.sendMessage },
    storage: { local: { get: vi.fn() } },
  },
}));

import {
  observeBlock,
  resumeUntranslatedBlocks,
  retryBlock,
  startIntersectionObserver,
} from "./blocks";
import { STATE, updatePageMatchers } from "./state";
import type { MlgTranslateResponse } from "./state";

interface FakeIntersectionObserverEntry {
  readonly isIntersecting: boolean;
  readonly target: Element;
}

type ObserverCallback = (entries: readonly FakeIntersectionObserverEntry[]) => void;

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];

  callback: ObserverCallback;
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();

  constructor(callback: ObserverCallback) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }
}

function createBlock(
  rect: Readonly<Pick<DOMRect, "bottom" | "left" | "right" | "top">>,
): HTMLElement {
  const block = document.createElement("p");
  block.dataset.mlgTranslating = "1";
  block.textContent = "A visible English sentence for translation.";
  const blockRect = new DOMRect(
    rect.left,
    rect.top,
    rect.right - rect.left,
    rect.bottom - rect.top,
  );
  vi.spyOn(block, "getBoundingClientRect").mockReturnValue(blockRect);
  document.body.append(block);
  return block;
}

function createIntersectionEntry(target: Element): FakeIntersectionObserverEntry {
  return {
    isIntersecting: true,
    target,
  };
}

function createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function successfulTranslationResponse(blockCount = 1): MlgTranslateResponse {
  return {
    blocks: Array.from({ length: blockCount }, () => ({
      sentences: [
        {
          source: "A visible English sentence for translation.",
          translation: "翻訳済みの英文です。",
        },
      ],
    })),
  };
}

function resetBlockTestState(): void {
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  FakeIntersectionObserver.instances = [];
  STATE.blockTranslateTimer = null;
  STATE.config.enabled = true;
  STATE.config.models = ["openrouter/deepseek/deepseek-chat"];
  STATE.config.pageListInclude = "*";
  STATE.config.pageListExclude = "";
  STATE.intersectionObserver = null;
  STATE.mode = "auto";
  STATE.pendingBlocks = [];
  STATE.runHref = location.href;
  updatePageMatchers();
  document.body.replaceChildren();
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
}

function cleanUpBlockTestState(): void {
  if (STATE.blockTranslateTimer !== null) {
    clearTimeout(STATE.blockTranslateTimer);
  }
  STATE.blockTranslateTimer = null;
  STATE.intersectionObserver = null;
  STATE.pendingBlocks = [];
  browserMocks.sendMessage.mockReset();
  vi.useRealTimers();
  vi.unstubAllGlobals();
}

beforeEach(() => {
  resetBlockTestState();
});

afterEach(() => {
  cleanUpBlockTestState();
});

describe("observeBlock", () => {
  it("queues a visible block once without waiting for observer delivery", () => {
    startIntersectionObserver();
    const observer = FakeIntersectionObserver.instances[0];
    if (!observer) throw new Error("expected intersection observer");
    const block = createBlock({ bottom: 120, left: 20, right: 120, top: 20 });

    observeBlock(block);

    expect(observer.observe).toHaveBeenCalledWith(block);
    expect(observer.unobserve).toHaveBeenCalledWith(block);
    expect(STATE.pendingBlocks).toHaveLength(1);
    expect(block.dataset.mlgQueued).toBe("1");
    observer.callback([createIntersectionEntry(block)]);
    expect(STATE.pendingBlocks).toHaveLength(1);
  });

  it("leaves a distant block to the observer until it intersects", () => {
    startIntersectionObserver();
    const observer = FakeIntersectionObserver.instances[0];
    if (!observer) throw new Error("expected intersection observer");
    const block = createBlock({ bottom: 5200, left: 20, right: 120, top: 5100 });

    observeBlock(block);

    expect(observer.observe).toHaveBeenCalledWith(block);
    expect(observer.unobserve).not.toHaveBeenCalled();
    expect(STATE.pendingBlocks).toHaveLength(0);
    observer.callback([createIntersectionEntry(block)]);
    expect(observer.unobserve).toHaveBeenCalledWith(block);
    expect(STATE.pendingBlocks).toHaveLength(1);
  });
});

describe("reader recovery", () => {
  it("re-observes a reader failure after reader mode clears its queue", () => {
    startIntersectionObserver();
    const observer = FakeIntersectionObserver.instances[0];
    if (!observer) throw new Error("expected intersection observer");
    const block = createBlock({ bottom: 5200, left: 20, right: 120, top: 5100 });
    block.dataset.mlgBlock = "1";
    block.dataset.mlgFailed = "1";
    block.dataset.mlgReaderFailed = "1";
    delete block.dataset.mlgTranslating;

    resumeUntranslatedBlocks();

    expect(block.dataset.mlgFailed).toBeUndefined();
    expect(block.dataset.mlgReaderFailed).toBeUndefined();
    expect(block.dataset.mlgTranslating).toBe("1");
    expect(observer.observe).toHaveBeenCalledWith(block);
  });
});

describe("batch concurrency", () => {
  it("starts the next batch chunk only after the current chunk finishes", async () => {
    vi.useFakeTimers();
    const requests = Array.from({ length: 4 }, () => createDeferred<MlgTranslateResponse>());
    let requestIndex = 0;
    browserMocks.sendMessage.mockImplementation(() => {
      const request = requests[requestIndex];
      requestIndex += 1;
      if (!request) throw new Error("unexpected translation request");
      return request.promise;
    });
    const blocks = Array.from({ length: 10 }, () =>
      createBlock({ bottom: 120, left: 20, right: 120, top: 20 }),
    );

    blocks.forEach((block) => {
      retryBlock(block);
    });
    vi.advanceTimersByTime(200);
    expect(browserMocks.sendMessage).toHaveBeenCalledTimes(3);

    requests.slice(0, 3).forEach((request) => {
      request.resolve(successfulTranslationResponse(3));
    });
    await vi.waitFor(() => {
      expect(browserMocks.sendMessage).toHaveBeenCalledTimes(4);
    });

    requests[3]?.resolve(successfulTranslationResponse());
    await vi.runAllTimersAsync();
  });
});
