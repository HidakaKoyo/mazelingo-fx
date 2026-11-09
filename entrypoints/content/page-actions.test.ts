// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refreshDisplay: vi.fn(),
  showStatus: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("./observer", () => ({ start: mocks.start, stop: mocks.stop }));
vi.mock("./status", () => ({ showStatus: mocks.showStatus }));
vi.mock("./root", () => ({ refreshDisplay: mocks.refreshDisplay }));

import { applySiteAutoTranslationChange, togglePageTranslation } from "./page-actions";
import { STATE } from "./state";

beforeEach(() => {
  Object.values(mocks).forEach((mock) => {
    mock.mockReset();
  });
  STATE.config.autoTranslate = true;
  STATE.config.enabled = true;
  STATE.pageTranslationOverride = null;
  STATE.started = false;
  mocks.start.mockImplementation(() => {
    STATE.started = true;
  });
  mocks.stop.mockImplementation(() => {
    STATE.started = false;
  });
});

it("toggles an explicitly requested page independently of the automatic list", () => {
  STATE.config.autoTranslate = false;
  togglePageTranslation();
  expect(STATE.pageTranslationOverride).toBe("on");
  expect(mocks.start).toHaveBeenCalledOnce();
  expect(mocks.refreshDisplay).toHaveBeenCalledOnce();

  togglePageTranslation();
  expect(STATE.pageTranslationOverride).toBe("off");
  expect(mocks.stop).toHaveBeenCalledOnce();
});

it("does nothing except notify when translation is disabled", () => {
  STATE.config.enabled = false;
  togglePageTranslation();
  applySiteAutoTranslationChange(true, "changed");
  expect(mocks.start).not.toHaveBeenCalled();
  expect(mocks.stop).not.toHaveBeenCalled();
  expect(mocks.showStatus).toHaveBeenCalledTimes(2);
});

it("starts and stops translation when the site setting changes", () => {
  applySiteAutoTranslationChange(true, "changed");
  expect(mocks.start).toHaveBeenCalledOnce();
  expect(mocks.refreshDisplay).toHaveBeenCalledOnce();
  applySiteAutoTranslationChange(false, "changed");
  expect(mocks.stop).toHaveBeenCalledOnce();
});

it("does not start site translation while automatic translation is off", () => {
  STATE.config.autoTranslate = false;

  applySiteAutoTranslationChange(true, "changed");

  expect(mocks.start).not.toHaveBeenCalled();
});

it("reports a broader match without stopping translation", () => {
  STATE.started = true;
  applySiteAutoTranslationChange(false, "broader-match");
  expect(mocks.stop).not.toHaveBeenCalled();
  expect(mocks.showStatus).toHaveBeenCalledWith(
    "より広い設定に含まれているため、このサイトだけは外せません",
  );
});
