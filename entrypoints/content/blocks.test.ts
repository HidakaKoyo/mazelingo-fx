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

import { observeBlock, retryBlock, startIntersectionObserver } from "./blocks";
import { STATE, updatePageMatchers } from "./state";

type ObserverCallback = (entries: IntersectionObserverEntry[]) => void;

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

function createBlock(rect: Pick<DOMRect, "bottom" | "left" | "right" | "top">): HTMLElement {
  const block = document.createElement("p");
  block.dataset.mlgTranslating = "1";
  block.textContent = "A visible English sentence for translation.";
  vi.spyOn(block, "getBoundingClientRect").mockReturnValue({
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
    top: rect.top,
  } as DOMRect);
  document.body.append(block);
  return block;
}

function createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function successfulTranslationResponse(blockCount = 1) {
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

describe("observeBlock", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    FakeIntersectionObserver.instances = [];
    STATE.intersectionObserver = null;
    STATE.pendingBlocks = [];
    STATE.config.pageListInclude = "*";
    STATE.config.pageListExclude = "";
    updatePageMatchers();
    document.body.replaceChildren();
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  });

  afterEach(() => {
    if (STATE.blockTranslateTimer !== null) {
      clearTimeout(STATE.blockTranslateTimer);
      STATE.blockTranslateTimer = null;
    }
    STATE.intersectionObserver = null;
    STATE.pendingBlocks = [];
    browserMocks.sendMessage.mockReset();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

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

    observer.callback([
      { isIntersecting: true, target: block } as unknown as IntersectionObserverEntry,
    ]);

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
    expect(block.dataset.mlgQueued).toBeUndefined();

    observer.callback([
      { isIntersecting: true, target: block } as unknown as IntersectionObserverEntry,
    ]);

    expect(observer.unobserve).toHaveBeenCalledWith(block);
    expect(STATE.pendingBlocks).toHaveLength(1);
  });

  it("starts the next batch chunk only after the current chunk finishes", async () => {
    vi.useFakeTimers();
    const requests = Array.from({ length: 4 }, () =>
      createDeferred<ReturnType<typeof successfulTranslationResponse>>(),
    );
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

    blocks.forEach(retryBlock);
    vi.advanceTimersByTime(200);

    expect(browserMocks.sendMessage).toHaveBeenCalledTimes(3);

    requests.slice(0, 3).forEach((request) => request.resolve(successfulTranslationResponse(3)));
    for (let index = 0; index < 10; index += 1) {
      await Promise.resolve();
    }

    expect(browserMocks.sendMessage).toHaveBeenCalledTimes(4);

    requests[3]?.resolve(successfulTranslationResponse());
    await Promise.resolve();
  });
});
