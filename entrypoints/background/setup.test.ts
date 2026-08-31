import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendMessage: vi.fn(),
}));

vi.mock(
  "wxt/utils/define-background",
  (): { defineBackground: (setup: () => void) => () => void } => ({
    defineBackground: (setup: () => void): (() => void) => setup,
  }),
);
vi.mock("wxt/browser", () => ({
  browser: {
    action: { onClicked: { addListener: vi.fn() } },
    commands: { onCommand: { addListener: vi.fn() } },
    runtime: { onInstalled: { addListener: vi.fn() }, onMessage: { addListener: vi.fn() } },
    storage: { local: { get: vi.fn(), set: vi.fn() } },
    tabs: { sendMessage: mocks.sendMessage },
  },
}));
vi.mock("@/utils/browser-actions", () => ({ openToolbarPanel: vi.fn() }));
vi.mock("./handlers", () => ({ handleMessage: vi.fn() }));

const { handleCommand } = await import("./setup");

describe("background shortcut", () => {
  it("sends readerRun only for the reader command", async () => {
    mocks.sendMessage.mockResolvedValue(null);
    handleCommand("other-command", { id: 3 });
    expect(mocks.sendMessage).not.toHaveBeenCalled();
    handleCommand("reader-translate-page", { id: 3 });
    await Promise.resolve();
    expect(mocks.sendMessage).toHaveBeenCalledWith(3, { type: "mlg:readerRun" });
  });
});
