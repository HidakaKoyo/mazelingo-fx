import { browser } from "wxt/browser";
import { mergeConfig } from "@/utils/config";
import type { Config } from "@/utils/config";
import type { Language, MlgMessage } from "@/utils/messages";
import { compilePageList, isPageAllowed as isPageAllowedLogic } from "@/utils/content-logic";
import type { PageMatcher } from "@/utils/content-logic";
import type { MlgSpan, NodeWithMeta } from "@/utils/dom-overlay";

export const HOVER_ACTIVATION_MS = 300;
export const TOGGLE_ANIMATION_MS = 1400;
const BUTTON_SELECTOR = "button,[role='button']",
  SKIP_SELECTOR =
    "script,style,textarea,input,code,pre,noscript,svg,math,select,option,nav,header,footer,aside,[role='navigation'],[role='banner'],[role='contentinfo'],[contenteditable='true'],[translate='no'],.notranslate,[data-mlg-sentence],[data-mlg-tooltip],[data-mlg-block]";

export const BLOCK_DISPLAY_VALUES = new Set([
  "block",
  "flex",
  "grid",
  "list-item",
  "table",
  "table-row",
  "table-cell",
  "table-caption",
  "flow-root",
]);

export const RETRY_COUNTDOWN_MS = 3000;
export const MAX_BLOCKS_PER_BATCH = 3;
export const MAX_CONCURRENT_BATCHES = 3;

export interface TooltipState {
  el: HTMLDivElement;
  text: HTMLDivElement;
  currentSpan: MlgSpan | null;
  anchor: { x: number; y: number } | null;
  hideTimer: ReturnType<typeof setTimeout> | null;
}

export interface PendingBlock {
  element: HTMLElement;
  htmlParts: string[];
  separators: string[];
  atoms: Map<number, Node>;
  lang: Language;
  retried?: boolean;
}

export interface MlgTtsResponse {
  dataUrl?: string;
  error?: string;
}

export interface MlgTranslateResponse {
  blocks?: ({ sentences: Array<{ source: string; translation: string }> | null } | null)[] | null;
  error?: string;
}

interface ContentState {
  config: Config;
  started: boolean;
  observer: MutationObserver | null;
  intersectionObserver: IntersectionObserver | null;
  pendingBlocks: PendingBlock[];
  blockTranslateTimer: ReturnType<typeof setTimeout> | null;
  tooltip: TooltipState | null;
  tooltipHover: boolean;
  hoverTimers: WeakMap<NodeWithMeta, ReturnType<typeof setTimeout>>;
  hoverAnchors: WeakMap<NodeWithMeta, { x: number; y: number }>;
  animations: WeakMap<NodeWithMeta, { rafId: number }>;
  includeMatchers: PageMatcher[];
  excludeMatchers: PageMatcher[];
}

const initialState: ContentState = {
  animations: new WeakMap(),
  blockTranslateTimer: null,
  config: mergeConfig({}),
  excludeMatchers: [],
  hoverAnchors: new WeakMap(),
  hoverTimers: new WeakMap(),
  includeMatchers: [],
  intersectionObserver: null,
  observer: null,
  pendingBlocks: [],
  started: false,
  tooltip: null,
  tooltipHover: false,
};

export const STATE: ContentState = initialState;

export function getSkipSelector(): string {
  let sel = SKIP_SELECTOR;
  if (!STATE.config.translateButtons) {
    sel += `,${BUTTON_SELECTOR}`;
  }
  return sel;
}

export function updatePageMatchers(): void {
  STATE.includeMatchers = compilePageList(STATE.config.pageListInclude);
  STATE.excludeMatchers = compilePageList(STATE.config.pageListExclude);
}

export function isPageAllowed(): boolean {
  return isPageAllowedLogic(location.href, STATE.includeMatchers, STATE.excludeMatchers);
}

export interface RuntimeError {
  readonly error: string;
}

export function isRuntimeError(value: unknown): value is RuntimeError {
  return typeof value === "object" && value !== null && "error" in value;
}

// Resolves with { error } when the service worker is unreachable so callers
// see the same shape as an application-level failure.
export function sendMessage<T = unknown>(message: MlgMessage): Promise<T | RuntimeError> {
  return new Promise<T | RuntimeError>((resolve) => {
    browser.runtime.sendMessage<MlgMessage, T | RuntimeError>(message, (response) => {
      const err = browser.runtime.lastError;
      if (err) {
        resolve({ error: err.message ?? "Service worker unreachable" });
        return;
      }
      resolve(response);
    });
  });
}

export async function loadConfig(): Promise<Config> {
  const config = await sendMessage<Config>({ type: "mlg:getConfig" });
  if (isRuntimeError(config)) {
    throw new Error(`getConfig failed: ${config.error}`);
  }
  return mergeConfig(config);
}

export function hasBlockedAncestor(element: Element | null): boolean {
  if (!element) {
    return true;
  }
  return Boolean(element.closest(getSkipSelector()));
}

export function isBlockElement(el: Element): boolean {
  if (el.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }
  return BLOCK_DISPLAY_VALUES.has(getComputedStyle(el).display);
}

export function findLeafBlocks(root: Node): Element[] {
  const results: Element[] = [];
  const walk = (el: Element): void => {
    if (el.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    if (el.matches(getSkipSelector())) {
      return;
    }
    const children = [...el.children];
    const hasBlockChild = children.some((child) => isBlockElement(child));
    if (hasBlockChild) {
      children.forEach((child) => {
        walk(child);
      });
    } else if (el.textContent && el.textContent.trim()) {
      results.push(el);
    }
  };
  const rootEl = root instanceof Element ? root : null;
  if (rootEl) {
    if (isBlockElement(rootEl)) {
      walk(rootEl);
    } else {
      [...rootEl.children].forEach((child) => {
        walk(child);
      });
    }
  }
  return results;
}
