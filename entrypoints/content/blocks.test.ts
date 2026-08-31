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

import { observeBlock, startIntersectionObserver } from "./blocks";
import { STATE } from "./state";

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

function createBlock(
  rect: Pick<DOMRect, "bottom" | "left" | "right" | "top">,
): HTMLElement {
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

describe("observeBlock", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    FakeIntersectionObserver.instances = [];
    STATE.intersectionObserver = null;
    STATE.pendingBlocks = [];
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

    observer.callback([{ isIntersecting: true, target: block } as unknown as IntersectionObserverEntry]);

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

    observer.callback([{ isIntersecting: true, target: block } as unknown as IntersectionObserverEntry]);

    expect(observer.unobserve).toHaveBeenCalledWith(block);
    expect(STATE.pendingBlocks).toHaveLength(1);
  });
});
