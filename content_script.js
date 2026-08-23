const STORAGE_KEY = "mlg_config";
const HOVER_ACTIVATION_MS = 300;
const TOGGLE_ANIMATION_MS = 1400;
const {
  isMlgIgnoredElement,
  isMlgAtom,
  buildTokenStream,
  locateUnitRange,
  wrapRange,
  renderVariant,
  renderOriginal,
} = globalThis.MazelingoDomOverlay || {};
if (
  !isMlgIgnoredElement || !isMlgAtom || !buildTokenStream ||
  !locateUnitRange || !wrapRange || !renderVariant || !renderOriginal
) {
  throw new Error("[mlg:cs] dom-overlay.js must load before content_script.js");
}
const DEFAULT_CONFIG = {
  enabled: true,
  models: ["glm-4.7-flash"],
  apiKeys: {},
  pageListInclude: "https://*",
  pageListExclude: "",
  mixLanguage: true,
  englishRatio: 30,
  translateButtons: false,
  minTextLength: 5,
  outputRatio: 20,
  ttsVoice: "nova",
};

const SKIP_SELECTOR =
  "script,style,textarea,input,code,pre,noscript,svg,math,select,option,nav,header,footer,aside,[role='navigation'],[role='banner'],[role='contentinfo'],[contenteditable='true'],[translate='no'],.notranslate,[data-mlg-sentence],[data-mlg-tooltip],[data-mlg-block]";

const BUTTON_SELECTOR = "button,[role='button']";

function getSkipSelector() {
  let sel = SKIP_SELECTOR;
  if (!STATE.config.translateButtons) {
    sel += "," + BUTTON_SELECTOR;
  }
  return sel;
}

const STATE = {
  config: DEFAULT_CONFIG,
  started: false,
  observer: null,
  intersectionObserver: null,
  pendingBlocks: [],
  blockTranslateTimer: null,
  tooltip: null,
  tooltipHover: false,
  hoverTimers: new WeakMap(),
  hoverAnchors: new WeakMap(),
  animations: new WeakMap(),
  includeMatchers: [],
  excludeMatchers: [],
};

function mergeConfig(raw) {
  const safe = raw || {};
  let models = safe.models;
  if (!Array.isArray(models)) {
    models = DEFAULT_CONFIG.models;
  }
  const merged = {
    ...DEFAULT_CONFIG,
    ...safe,
    models,
    apiKeys: { ...DEFAULT_CONFIG.apiKeys, ...(safe.apiKeys || {}) },
  };
  delete merged.providerId;
  delete merged.apiKey;
  delete merged.providerOptions;
  return merged;
}

function normalizePagePattern(pattern) {
  if (!pattern) return "";
  if (pattern.includes("://")) return pattern;
  return `*://${pattern}`;
}

function globToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\?]/g, "\\$&");
  const regex = escaped.replace(/\*/g, ".*");
  return new RegExp(`^${regex}$`, "i");
}

function compilePageList(list) {
  return String(list || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((pattern) => ({
      regex: globToRegExp(normalizePagePattern(pattern)),
    }));
}

function updatePageMatchers() {
  STATE.includeMatchers = compilePageList(STATE.config.pageListInclude);
  STATE.excludeMatchers = compilePageList(STATE.config.pageListExclude);
}

function isPageAllowed() {
  if (STATE.includeMatchers.length === 0) return false;
  const included = STATE.includeMatchers.some((m) => m.regex.test(location.href));
  if (!included) return false;
  const excluded = STATE.excludeMatchers.some((m) => m.regex.test(location.href));
  return !excluded;
}

// Resolves with { error } when the service worker is unreachable so callers
// see the same shape as an application-level failure.
function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      const err = chrome.runtime.lastError;
      if (err) {
        resolve({ error: err.message });
        return;
      }
      resolve(response);
    });
  });
}

async function loadConfig() {
  const config = await sendMessage({ type: "mlg:getConfig" });
  if (config?.error) throw new Error(`getConfig failed: ${config.error}`);
  return mergeConfig(config);
}

function detectLang(text) {
  return /[ぁ-んァ-ン一-龯]/.test(text) ? "ja" : "en";
}

function hashString(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function shouldShowEnglish(text, ratio, seed) {
  const normalized = Math.max(0, Math.min(100, Number(ratio) || 0));
  const value = hashString(`${seed}::${text}`) % 100;
  return value < normalized;
}

function hasBlockedAncestor(element) {
  if (!element) return true;
  return Boolean(element.closest(getSkipSelector()));
}

// --- Leaf block detection ---

const BLOCK_DISPLAY_VALUES = new Set([
  "block", "flex", "grid", "list-item", "table", "table-row", "table-cell",
  "table-caption", "flow-root",
]);

function isBlockElement(el) {
  if (el.nodeType !== Node.ELEMENT_NODE) return false;
  return BLOCK_DISPLAY_VALUES.has(getComputedStyle(el).display);
}

function findLeafBlocks(root) {
  const results = [];
  function walk(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    if (el.matches && el.matches(getSkipSelector())) return;
    const children = Array.from(el.children);
    const hasBlockChild = children.some(isBlockElement);
    if (!hasBlockChild) {
      // Leaf block: no block children
      if (el.textContent && el.textContent.trim()) {
        results.push(el);
      }
    } else {
      // Has block children: recurse into them
      children.forEach(walk);
    }
  }
  if (root.nodeType === Node.ELEMENT_NODE) {
    if (isBlockElement(root)) {
      walk(root);
    } else {
      // root itself is inline, check its children
      Array.from(root.children).forEach(walk);
    }
  }
  console.log("[mlg:cs] findLeafBlocks found", results.length, "blocks");
  return results;
}

// --- Text helpers ---

function getEnglishText(span) {
  const source = span.dataset.mlgSource || "";
  const translation = span.dataset.mlgTranslation || "";
  const sourceLang = span.dataset.mlgLang || "en";
  if (sourceLang === "en") return source;
  return translation || source;
}

function getJapaneseText(span) {
  const source = span.dataset.mlgSource || "";
  const translation = span.dataset.mlgTranslation || "";
  const sourceLang = span.dataset.mlgLang || "en";
  if (sourceLang === "ja") return source;
  return translation || source;
}

function getSourceLang(span) {
  return span.dataset.mlgLang || "en";
}

function getOppositeLang(lang) {
  return lang === "en" ? "ja" : "en";
}

function assignBlockDisplayLanguages(spans) {
  if (!STATE.config.mixLanguage) {
    spans.forEach((span) => {
      span.dataset.mlgDefaultDisplay = span.dataset.mlgLang || "en";
    });
    return;
  }
  const total = spans.length;
  const seed = hashString(location.href + "::" + spans.map(s => s.dataset.mlgSource).join("|"));
  // Stochastic rounding: fractional part becomes probability of rounding up
  const exact = total * STATE.config.englishRatio / 100;
  const floor = Math.floor(exact);
  const frac = exact - floor;
  const roundUp = (Math.abs(seed * 2654435761 | 0) % 100) < frac * 100;
  const enCount = roundUp ? floor + 1 : floor;
  const displays = [];
  for (let i = 0; i < total; i++) {
    displays.push(i < enCount ? "en" : "ja");
  }
  for (let i = displays.length - 1; i > 0; i--) {
    const j = Math.abs((seed * (i + 1) * 2654435761) | 0) % (i + 1);
    [displays[i], displays[j]] = [displays[j], displays[i]];
  }
  spans.forEach((span, i) => {
    span.dataset.mlgDefaultDisplay = displays[i];
  });
}

function getDesiredDisplay(span) {
  const manual = span.dataset.mlgDisplay;
  if (manual === "en" || manual === "ja") {
    return manual;
  }
  return span.dataset.mlgDefaultDisplay || span.dataset.mlgLang || "en";
}

function getShownLang(span) {
  return span.dataset.mlgShown || getSourceLang(span);
}

function getDisplayLang(span) {
  return getShownLang(span);
}

function getVariantPlainText(span, lang) {
  const html = lang === "en" ? getEnglishText(span) : getJapaneseText(span);
  return stripHtmlTags(html);
}

function renderSpanDisplay(span, lang) {
  const sourceLang = getSourceLang(span);
  const hasTranslation = typeof span.dataset.mlgTranslation === "string" &&
    span.dataset.mlgTranslation.length > 0;
  if (lang === sourceLang || !hasTranslation) {
    renderOriginal(span);
    span.dataset.mlgShown = sourceLang;
  } else {
    renderVariant(
      span,
      sanitizeHtmlFragment(span.dataset.mlgTranslation),
      span.__mlgBlockAtoms
    );
    span.dataset.mlgShown = lang;
  }
}

function applyDefaultDisplay(span) {
  if (span.dataset.mlgAnimating === "1") {
    return;
  }
  const config = STATE.config;
  if (!config.enabled) {
    renderSpanDisplay(span, getSourceLang(span));
    return;
  }
  const display = getDesiredDisplay(span);
  renderSpanDisplay(span, display);
}

function isInteractiveEnabled() {
  return STATE.config.enabled && isPageAllowed();
}

// --- Tooltip ---

function stripHtmlTags(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || "").replace(/⟦\d+⟧/g, "");
}

function getTooltipText(span) {
  const current = getDisplayLang(span);
  const other = getOppositeLang(current);
  const html = other === "en" ? getEnglishText(span) : getJapaneseText(span);
  return stripHtmlTags(html);
}

function ensureTooltip() {
  if (STATE.tooltip?.el) return;
  const tooltip = document.createElement("div");
  tooltip.className = "mlg-tooltip notranslate";
  tooltip.dataset.mlgTooltip = "1";
  tooltip.setAttribute("translate", "no");
  tooltip.setAttribute("role", "tooltip");
  const text = document.createElement("div");
  text.className = "mlg-tooltip-text";
  tooltip.appendChild(text);
  tooltip.style.display = "none";
  tooltip.addEventListener("mouseenter", () => {
    STATE.tooltipHover = true;
    clearTooltipHideTimer();
  });
  tooltip.addEventListener("mouseleave", () => {
    STATE.tooltipHover = false;
    scheduleTooltipHide();
  });
  tooltip.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!STATE.tooltip?.currentSpan) return;
    toggleSpanDisplay(STATE.tooltip.currentSpan);
    STATE.tooltipHover = false;
    hideTooltip();
  });
  document.body.appendChild(tooltip);
  STATE.tooltip = {
    el: tooltip,
    text,
    currentSpan: null,
    hideTimer: null,
  };
  window.addEventListener(
    "scroll",
    () => {
      if (STATE.tooltip?.currentSpan && tooltip.style.display !== "none") {
        positionTooltip(STATE.tooltip.currentSpan);
      }
    },
    { passive: true }
  );
  window.addEventListener("resize", () => {
    if (STATE.tooltip?.currentSpan && tooltip.style.display !== "none") {
      positionTooltip(STATE.tooltip.currentSpan);
    }
  });
}

function updateTooltip(span) {
  if (!STATE.tooltip?.text) return;
  STATE.tooltip.text.textContent = getTooltipText(span);
}

function positionTooltip(span, anchor) {
  if (!STATE.tooltip?.el) return;
  const tooltip = STATE.tooltip.el;
  const point = anchor || STATE.tooltip.anchor;
  if (!point) return;
  const margin = 8;
  const gap = 15;
  tooltip.style.maxWidth = `${Math.min(360, window.innerWidth - margin * 2)}px`;
  tooltip.style.visibility = "hidden";
  tooltip.style.display = "block";
  const tooltipRect = tooltip.getBoundingClientRect();
  const anchorX = point.x;
  const anchorY = point.y;
  let top = anchorY - tooltipRect.height - gap;
  top = Math.max(margin, top);
  let left = anchorX - tooltipRect.width / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - tooltipRect.width - margin));
  const arrowLeft = Math.max(
    12,
    Math.min(Math.round(anchorX - left), tooltipRect.width - 12)
  );
  tooltip.style.top = `${Math.round(top)}px`;
  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.dataset.placement = "top";
  tooltip.style.setProperty("--mlg-tooltip-arrow-left", `${arrowLeft}px`);
  tooltip.style.visibility = "visible";
}

function showTooltip(span, anchor) {
  if (!isInteractiveEnabled()) return;
  clearTooltipHideTimer();
  ensureTooltip();
  STATE.tooltip.currentSpan = span;
  if (anchor) {
    STATE.tooltip.anchor = { x: anchor.x, y: anchor.y };
  }
  updateTooltip(span);
  positionTooltip(span, anchor);
}

function hideTooltip() {
  if (!STATE.tooltip?.el) return;
  STATE.tooltip.el.style.display = "none";
  STATE.tooltip.currentSpan = null;
}

function clearTooltipHideTimer() {
  if (STATE.tooltip?.hideTimer) {
    clearTimeout(STATE.tooltip.hideTimer);
    STATE.tooltip.hideTimer = null;
  }
}

function scheduleTooltipHide() {
  if (!STATE.tooltip?.el) return;
  clearTooltipHideTimer();
  STATE.tooltip.hideTimer = setTimeout(() => {
    if (!STATE.tooltipHover) {
      hideTooltip();
    }
  }, 120);
}

function updateHoverAnchor(span, event) {
  const point = { x: event.clientX, y: event.clientY };
  STATE.hoverAnchors.set(span, point);
  if (STATE.tooltip?.currentSpan === span && STATE.tooltip.el.style.display !== "none") {
    positionTooltip(span, point);
  }
}

// --- Hover ---

function scheduleHoverTooltip(span) {
  if (!isInteractiveEnabled()) return;
  cancelHoverTooltip(span);
  clearTooltipHideTimer();
  const timerId = setTimeout(() => {
    const anchor = STATE.hoverAnchors.get(span);
    if (!span.isConnected || !span.matches(":hover")) return;
    showTooltip(span, anchor);
  }, HOVER_ACTIVATION_MS);
  STATE.hoverTimers.set(span, timerId);
}

function cancelHoverTooltip(span) {
  const timerId = STATE.hoverTimers.get(span);
  if (timerId) {
    clearTimeout(timerId);
    STATE.hoverTimers.delete(span);
  }
}

// --- Animation ---

function cancelSpanAnimation(span) {
  const anim = STATE.animations.get(span);
  if (anim) {
    cancelAnimationFrame(anim.rafId);
    STATE.animations.delete(span);
  }
}

function getAnimatedTextNodes(span) {
  const textNodes = [];
  function visit(node) {
    Array.from(node.childNodes || []).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        textNodes.push(child);
      } else if (child.nodeType === Node.ELEMENT_NODE && !isMlgAtom(child)) {
        visit(child);
      }
    });
  }
  visit(span);
  return textNodes;
}

function distributeAnimatedText(textNodes, text, originalLengths) {
  let cursor = 0;
  textNodes.forEach((node, index) => {
    const remaining = text.length - cursor;
    const take = index === textNodes.length - 1
      ? Math.max(0, remaining)
      : Math.min(Math.max(0, remaining), originalLengths[index]);
    node.data = text.slice(cursor, cursor + take);
    cursor += take;
  });
}

function runToggleAnimation(span, fromLang, toLang) {
  cancelSpanAnimation(span);
  const fromText = getVariantPlainText(span, fromLang);
  const toText = getVariantPlainText(span, toLang);
  const textNodes = getAnimatedTextNodes(span);
  if ((!fromText && !toText) || textNodes.length === 0) {
    span.dataset.mlgDisplay = toLang;
    renderSpanDisplay(span, toLang);
    return;
  }

  const originalLengths = textNodes.map((node) => node.data.length);
  span.dataset.mlgAnimating = "1";
  const start = performance.now();
  const duration = TOGGLE_ANIMATION_MS;

  const step = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const toVisible = Math.floor(toText.length * progress);
    const fromVisible = Math.ceil(fromText.length * (1 - progress));
    const fromStart = Math.max(0, fromText.length - fromVisible);
    distributeAnimatedText(
      textNodes,
      toText.slice(0, toVisible) + fromText.slice(fromStart),
      originalLengths
    );

    if (progress < 1) {
      const rafId = requestAnimationFrame(step);
      STATE.animations.set(span, { rafId });
    } else {
      delete span.dataset.mlgAnimating;
      span.dataset.mlgDisplay = toLang;
      renderSpanDisplay(span, toLang);
      STATE.animations.delete(span);
      if (STATE.tooltip?.currentSpan === span) {
        updateTooltip(span);
        positionTooltip(span);
      }
    }
  };

  const rafId = requestAnimationFrame(step);
  STATE.animations.set(span, { rafId });
}

function consumePendingAnimation(span) {
  const fromLang = span.dataset.mlgAnimateFrom;
  const toLang = span.dataset.mlgAnimateTo;
  if (!fromLang || !toLang) return false;
  delete span.dataset.mlgAnimateFrom;
  delete span.dataset.mlgAnimateTo;
  runToggleAnimation(span, fromLang, toLang);
  return true;
}

// --- TTS ---

const TTS_SPEAKER_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></svg>`;
const TTS_PLAY_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
const TTS_PAUSE_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
const TTS_LOADING_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2a10 10 0 0110 10" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></path></svg>`;

let ttsBtn = null;
let hoverActions = null;
let ttsPopup = null;
let ttsAudio = null;
let ttsBtnSpan = null;
let ttsHideTimer = null;

let ttsShowTimer = null;

function showTtsBtn(span, event) {
  // Don't override if user is hovering the button itself
  if (hoverActions?.matches(":hover")) return;
  // Cancel any pending hide
  clearTtsBtnHide();
  // Delay showing for a new span
  if (ttsShowTimer) clearTimeout(ttsShowTimer);
  ttsShowTimer = setTimeout(() => {
    ttsShowTimer = null;
    showTtsBtnImmediate(span);
  }, HOVER_ACTIVATION_MS);
}

function showTtsBtnImmediate(span) {
  if (!hoverActions) {
    hoverActions = document.createElement("div");
    hoverActions.className = "mlg-hover-actions notranslate";
    hoverActions.setAttribute("translate", "no");

    ttsBtn = document.createElement("button");
    ttsBtn.className = "mlg-tts-btn";
    ttsBtn.type = "button";
    ttsBtn.title = "音声を再生";
    ttsBtn.innerHTML = TTS_SPEAKER_SVG;
    ttsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (ttsBtnSpan) openTtsPopup(ttsBtnSpan, e);
    });

    const explainBtn = document.createElement("button");
    explainBtn.className = "mlg-explain-btn";
    explainBtn.type = "button";
    explainBtn.title = "文法解説";
    explainBtn.textContent = "解説";
    explainBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (ttsBtnSpan) openExplanation(ttsBtnSpan);
    });

    hoverActions.addEventListener("mouseenter", () => clearTtsBtnHide());
    hoverActions.addEventListener("mouseleave", () => scheduleTtsBtnHide());
    hoverActions.appendChild(ttsBtn);
    hoverActions.appendChild(explainBtn);
    document.body.appendChild(hoverActions);
  }
  ttsBtnSpan = span;
  const rects = span.getClientRects();
  const rect = rects.length > 0 ? rects[0] : span.getBoundingClientRect();
  hoverActions.style.top = `${rect.top + window.scrollY + (rect.height - 22) / 2}px`;
  hoverActions.style.left = `${rect.left + window.scrollX - 42}px`;
  hoverActions.classList.add("is-visible");
}

function hideTtsBtn() {
  if (ttsShowTimer) { clearTimeout(ttsShowTimer); ttsShowTimer = null; }
  if (hoverActions) hoverActions.classList.remove("is-visible");
  ttsBtnSpan = null;
}

function scheduleTtsBtnHide() {
  clearTtsBtnHide();
  ttsHideTimer = setTimeout(() => {
    if (!hoverActions?.matches(":hover")) hideTtsBtn();
  }, 300);
}

function clearTtsBtnHide() {
  if (ttsHideTimer) { clearTimeout(ttsHideTimer); ttsHideTimer = null; }
}

function openTtsPopup(span, event) {
  closeTtsPopup();
  const englishText = getEnglishText(span);
  const text = stripHtmlTags(englishText);
  if (!text) return;

  ttsPopup = document.createElement("div");
  ttsPopup.className = "mlg-tts-popup";

  const playBtn = document.createElement("button");
  playBtn.className = "mlg-tts-popup-play is-loading";
  playBtn.innerHTML = TTS_LOADING_SVG;

  const seekBar = document.createElement("input");
  seekBar.type = "range";
  seekBar.className = "mlg-tts-popup-seek";
  seekBar.min = "0";
  seekBar.max = "100";
  seekBar.value = "0";

  const timeEl = document.createElement("span");
  timeEl.className = "mlg-tts-popup-time";
  timeEl.textContent = "0:00";

  const closeBtn = document.createElement("button");
  closeBtn.className = "mlg-tts-popup-close";
  closeBtn.innerHTML = "&times;";
  closeBtn.addEventListener("click", (e) => { e.stopPropagation(); closeTtsPopup(); });

  ttsPopup.appendChild(playBtn);
  ttsPopup.appendChild(seekBar);
  ttsPopup.appendChild(timeEl);
  ttsPopup.appendChild(closeBtn);
  document.body.appendChild(ttsPopup);

  // Position
  const rects = span.getClientRects();
  const rect = rects.length > 0 ? rects[0] : span.getBoundingClientRect();
  ttsPopup.style.top = `${rect.top + window.scrollY - ttsPopup.offsetHeight - 8}px`;
  ttsPopup.style.left = `${Math.max(4, rect.left + window.scrollX)}px`;

  // Close on outside click
  function onOutsideClick(e) {
    if (ttsPopup && !ttsPopup.contains(e.target)) {
      closeTtsPopup();
      document.removeEventListener("click", onOutsideClick, true);
    }
  }
  setTimeout(() => document.addEventListener("click", onOutsideClick, true), 0);

  // Fetch TTS
  sendMessage({ type: "mlg:tts", payload: { text, voice: STATE.config.ttsVoice } }).then((res) => {
    if (!ttsPopup) return; // popup was closed
    if (!res || res.error) {
      playBtn.classList.remove("is-loading");
      playBtn.innerHTML = "!";
      playBtn.title = res?.error || "TTS failed";
      return;
    }
    ttsAudio = new Audio(res.dataUrl);
    playBtn.classList.remove("is-loading");
    playBtn.innerHTML = TTS_PLAY_SVG;

    function formatTime(sec) {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}:${s.toString().padStart(2, "0")}`;
    }

    function updateBtn() {
      if (!ttsAudio) return;
      playBtn.innerHTML = ttsAudio.paused ? TTS_PLAY_SVG : TTS_PAUSE_SVG;
    }

    let seeking = false;
    ttsAudio.addEventListener("timeupdate", () => {
      if (!ttsAudio || seeking) return;
      const pct = ttsAudio.duration ? (ttsAudio.currentTime / ttsAudio.duration) * 100 : 0;
      seekBar.value = pct;
      timeEl.textContent = formatTime(ttsAudio.currentTime);
    });
    ttsAudio.addEventListener("ended", updateBtn);
    ttsAudio.addEventListener("pause", updateBtn);
    ttsAudio.addEventListener("play", updateBtn);

    seekBar.addEventListener("input", () => {
      seeking = true;
      if (ttsAudio && ttsAudio.duration) {
        timeEl.textContent = formatTime((seekBar.value / 100) * ttsAudio.duration);
      }
    });
    seekBar.addEventListener("change", () => {
      if (ttsAudio && ttsAudio.duration) {
        ttsAudio.currentTime = (seekBar.value / 100) * ttsAudio.duration;
      }
      seeking = false;
    });

    playBtn.addEventListener("click", () => {
      if (!ttsAudio) return;
      if (ttsAudio.paused) {
        if (ttsAudio.ended) ttsAudio.currentTime = 0;
        ttsAudio.play();
      } else {
        ttsAudio.pause();
      }
    });

    // Highlight
    span.classList.add("is-playing");
    ttsAudio.addEventListener("ended", () => span.classList.remove("is-playing"));

    // Auto-play
    ttsAudio.play();
  });
}

function closeTtsPopup() {
  document.querySelectorAll(".mlg-sentence.is-playing").forEach((el) => el.classList.remove("is-playing"));
  if (ttsAudio) {
    ttsAudio.pause();
    ttsAudio = null;
  }
  if (ttsPopup) {
    ttsPopup.remove();
    ttsPopup = null;
  }
}

function openExplanation(span) {
  closeTtsPopup();
  const sourceLang = getSourceLang(span);
  const sourceText = stripHtmlTags(span.dataset.mlgSource || span.textContent || "").trim();
  const translationText = stripHtmlTags(span.dataset.mlgTranslation || "").trim();
  const englishText = stripHtmlTags(getEnglishText(span)).trim();
  const japaneseText = sourceLang === "ja"
    ? sourceText
    : (translationText || stripHtmlTags(getJapaneseText(span)).trim());
  const text = englishText || sourceText;
  if (!text) return;

  hideTtsBtn();
  sendMessage({
    type: "mlg:openExplanation",
    payload: {
      text,
      englishText,
      japaneseText,
      sourceText,
      sourceLang,
      pageUrl: location.href,
      origin: location.origin,
    },
  });
}

// --- Interactions ---

function bindInteractions(span) {
  if (span.dataset.mlgBound) return;
  span.dataset.mlgBound = "1";
  span.addEventListener("mouseenter", (event) => {
    updateHoverAnchor(span, event);
    scheduleHoverTooltip(span);
    showTtsBtn(span, event);
  });
  span.addEventListener("mousemove", (event) => {
    updateHoverAnchor(span, event);
  });
  span.addEventListener("mouseleave", () => {
    cancelHoverTooltip(span);
    scheduleTooltipHide();
    scheduleTtsBtnHide();
  });
}

function toggleSpanDisplay(span) {
  if (!isInteractiveEnabled()) return;
  const current = getShownLang(span);
  const next = getOppositeLang(current);
  span.dataset.mlgDisplay = next;
  runToggleAnimation(span, current, next);
}

// --- Block-level translation ---

const READING_UNIT_END_RE = /[。．.!！?？…」』）)]$/u;

function endsWithReadingUnitPunctuation(html) {
  const text = html.replace(/<[^>]*>/g, "").trimEnd();
  return READING_UNIT_END_RE.test(text);
}

function splitHtmlByLineBreaks(html) {
  // Blank lines always split. A single newline or <br> splits only when the
  // preceding tag-stripped text ends with reading-unit punctuation.
  // Returns matched pairs: separators[i] sits between parts[i] and parts[i+1].
  const rawParts = [];
  const rawSeparators = [];
  const regex = /(?:\r\n|\n|<br\b[^>]*>)(?:[ \t]*(?:\r\n|\n|<br\b[^>]*>))*/gi;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const breakCount = (match[0].match(/\r\n|\n|<br\b[^>]*>/gi) || []).length;
    const shouldSplit = breakCount >= 2 || endsWithReadingUnitPunctuation(html.slice(lastIndex, match.index));
    if (!shouldSplit) continue;

    rawParts.push(html.slice(lastIndex, match.index));
    rawSeparators.push(match[0]);
    lastIndex = regex.lastIndex;
  }
  rawParts.push(html.slice(lastIndex));

  // Filter out empty parts while keeping separators aligned
  const parts = [];
  const separators = [];
  let pendingSep = "";
  for (let i = 0; i < rawParts.length; i++) {
    if (rawParts[i].trim()) {
      parts.push(rawParts[i]);
      if (parts.length > 1) {
        separators.push(pendingSep);
      }
      pendingSep = "";
    }
    if (i < rawSeparators.length) {
      pendingSep += rawSeparators[i];
    }
  }
  // separators[i] sits between parts[i] and parts[i+1]
  return { parts, separators };
}

const RETRY_COUNTDOWN_MS = 3000;

function isBlockPending(block) {
  return block.dataset.mlgTranslating === "1" || block.dataset.mlgFailed === "1";
}

function retryBlock(block) {
  delete block.dataset.mlgFailed;
  block.dataset.mlgTranslating = "1";
  enqueueBlock(block);
}

const MLG_CLEAN_ATOM_ATTRIBUTE = "data-mlg-clean-atom";
const MLG_ALLOWED_HTML_TAGS = new Set([
  "a", "b", "i", "em", "strong", "span", "img", "br", "code", "s", "u", "mark",
]);

function cloneBlockForTranslation(block) {
  const documentRef = block.ownerDocument;
  const clone = block.cloneNode(false);
  const atoms = new Map();
  let nextAtomNumber = 1;

  function cloneNodeForTranslation(node) {
    if (node.nodeType === Node.TEXT_NODE) return documentRef.createTextNode(node.data);
    if (node.nodeType !== Node.ELEMENT_NODE || isMlgIgnoredElement(node)) return null;

    const elementClone = node.cloneNode(false);
    if (isMlgAtom(node)) {
      const atomNumber = nextAtomNumber++;
      atoms.set(atomNumber, node);
      elementClone.setAttribute(MLG_CLEAN_ATOM_ATTRIBUTE, String(atomNumber));
      return elementClone;
    }

    Array.from(elementClone.attributes).forEach((attribute) => {
      const tagName = elementClone.tagName.toLowerCase();
      const attributeName = attribute.name.toLowerCase();
      const keepHref = tagName === "a" && attributeName === "href";
      if (!keepHref) elementClone.removeAttribute(attribute.name);
    });
    Array.from(node.childNodes).forEach((child) => {
      const childClone = cloneNodeForTranslation(child);
      if (childClone) elementClone.appendChild(childClone);
    });
    return elementClone;
  }

  Array.from(block.childNodes).forEach((child) => {
    const childClone = cloneNodeForTranslation(child);
    if (childClone) clone.appendChild(childClone);
  });
  return { clone, atoms };
}

function replaceCloneAtomsWithPlaceholders(clone) {
  clone.querySelectorAll(`[${MLG_CLEAN_ATOM_ATTRIBUTE}]`).forEach((element) => {
    const atomNumber = element.getAttribute(MLG_CLEAN_ATOM_ATTRIBUTE);
    element.replaceWith(clone.ownerDocument.createTextNode(`⟦${atomNumber}⟧`));
  });
  return clone;
}

function cleanHtmlForTranslation(block) {
  const prepared = cloneBlockForTranslation(block);
  const serializedClone = replaceCloneAtomsWithPlaceholders(prepared.clone.cloneNode(true));
  return {
    html: serializedClone.innerHTML,
    atoms: prepared.atoms,
    clone: prepared.clone,
  };
}

function serializeCleanPart(html) {
  const container = document.createElement("div");
  container.innerHTML = html;
  replaceCloneAtomsWithPlaceholders(container);
  return container.innerHTML;
}

function hasTranslatableText(cleanedHtml) {
  const container = document.createElement("div");
  container.innerHTML = cleanedHtml;
  return (container.textContent || "").replace(/⟦\d+⟧/g, "").trim().length > 0;
}

function compactUrlForSchemeCheck(value) {
  return typeof value === "string"
    ? value.trim().replace(/[\u0000-\u0020\u007f]+/g, "")
    : "";
}

function isAllowedHref(value) {
  if (typeof value !== "string") return false;
  const compact = compactUrlForSchemeCheck(value);
  const scheme = compact.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  return !scheme || scheme === "http" || scheme === "https";
}

function isAllowedImageSrc(value) {
  if (typeof value !== "string") return false;
  const compact = compactUrlForSchemeCheck(value);
  if (/^data:image\//i.test(compact)) return true;
  const scheme = compact.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  return scheme === "http" || scheme === "https";
}

function sanitizeHtmlFragment(html) {
  const parsed = new DOMParser().parseFromString(typeof html === "string" ? html : "", "text/html");

  function sanitizeChildren(parent) {
    Array.from(parent.children).forEach((element) => {
      sanitizeChildren(element);
      const tagName = element.tagName.toLowerCase();
      if (!MLG_ALLOWED_HTML_TAGS.has(tagName)) {
        element.replaceWith(...element.childNodes);
        return;
      }

      Array.from(element.attributes).forEach((attribute) => {
        const attributeName = attribute.name.toLowerCase();
        if (attributeName.startsWith("on")) {
          element.removeAttribute(attribute.name);
          return;
        }
        if (tagName === "a" && attributeName === "href" && isAllowedHref(attribute.value)) return;
        if (tagName === "img" && attributeName === "src" && isAllowedImageSrc(attribute.value)) return;
        if (tagName === "img" && attributeName === "alt") return;
        element.removeAttribute(attribute.name);
      });
    });
  }

  sanitizeChildren(parsed.body);
  return parsed.body.innerHTML;
}

function enqueueBlock(block) {
  if (!block.isConnected || block.dataset.mlgTranslating !== "1") return;
  const lang = detectLang(block.textContent);
  const cleaned = cleanHtmlForTranslation(block);
  if (!hasTranslatableText(cleaned.html)) {
    delete block.dataset.mlgTranslating;
    return;
  }
  const { parts, separators } = splitHtmlByLineBreaks(cleaned.clone.innerHTML);
  const cleanParts = parts.map(serializeCleanPart);
  STATE.pendingBlocks.push({
    element: block,
    htmlParts: cleanParts,
    separators,
    atoms: cleaned.atoms,
    lang,
  });
  queueBlockTranslate();
}

function bindBlockHover(block) {
  let retryTimerId = null;
  let countdownId = null;

  function clearRetryTimers() {
    if (retryTimerId) { clearTimeout(retryTimerId); retryTimerId = null; }
    if (countdownId) { clearInterval(countdownId); countdownId = null; }
  }

  function startRetryCountdown(anchor) {
    clearRetryTimers();
    const startTime = Date.now();
    ensureTooltip();
    STATE.tooltip.currentSpan = block;
    STATE.tooltip.anchor = anchor;

    function updateCountdown() {
      const remaining = Math.max(0, Math.ceil((RETRY_COUNTDOWN_MS - (Date.now() - startTime)) / 1000));
      STATE.tooltip.text.textContent = `Translation failed. Retrying in ${remaining}s...`;
      positionTooltip(block, STATE.tooltip.anchor);
    }
    updateCountdown();
    countdownId = setInterval(updateCountdown, 200);

    retryTimerId = setTimeout(() => {
      clearRetryTimers();
      hideTooltip();
      retryBlock(block);
    }, RETRY_COUNTDOWN_MS);
  }

  block.addEventListener("mouseenter", (event) => {
    if (!isBlockPending(block)) return;
    const anchor = { x: event.clientX, y: event.clientY };
    if (block.dataset.mlgFailed === "1") {
      startRetryCountdown(anchor);
    } else {
      ensureTooltip();
      STATE.tooltip.text.textContent = "Translating...";
      STATE.tooltip.currentSpan = block;
      STATE.tooltip.anchor = anchor;
      positionTooltip(block, anchor);
    }
  });
  block.addEventListener("mousemove", (event) => {
    if (!isBlockPending(block)) return;
    if (STATE.tooltip?.currentSpan === block) {
      const anchor = { x: event.clientX, y: event.clientY };
      STATE.tooltip.anchor = anchor;
      positionTooltip(block, anchor);
    }
  });
  block.addEventListener("mouseleave", () => {
    clearRetryTimers();
    if (STATE.tooltip?.currentSpan === block) {
      hideTooltip();
    }
  });
}

function startIntersectionObserver() {
  if (STATE.intersectionObserver) return;
  STATE.intersectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const block = entry.target;
      if (block.dataset.mlgQueued === "1") return;
      block.dataset.mlgQueued = "1";
      STATE.intersectionObserver.unobserve(block);
      enqueueBlock(block);
    });
  }, { rootMargin: "1000px" });
}

function addEditButton(block) {
  const wrap = document.createElement("div");
  wrap.className = "mlg-edit-btn-wrap";
  wrap.dataset.mlgTooltip = "1";

  const btn = document.createElement("button");
  btn.className = "mlg-edit-btn";
  btn.setAttribute("aria-label", "Edit");
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="M15 5l4 4"/></svg>`;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    const text = block.textContent || "";
    sendMessage({ type: "mlg:openOutput", payload: { text: text.trim(), origin: location.origin } });
  });
  wrap.appendChild(btn);

  function positionWrap() {
    const rect = block.getBoundingClientRect();
    wrap.style.top = `${rect.top + window.scrollY + 2}px`;
    wrap.style.left = `${rect.right + window.scrollX - 26}px`;
  }

  function show() {
    positionWrap();
    wrap.classList.add("is-visible");
  }
  function hide() {
    wrap.classList.remove("is-visible");
  }

  block.addEventListener("mouseenter", show);
  block.addEventListener("mouseleave", () => {
    // Delay hide to allow moving to the button
    setTimeout(() => {
      if (!wrap.matches(":hover")) hide();
    }, 100);
  });
  wrap.addEventListener("mouseenter", () => {
    positionWrap();
    wrap.classList.add("is-visible");
  });
  wrap.addEventListener("mouseleave", hide);

  document.body.appendChild(wrap);
}

function buildNormaKey(text) {
  return `${location.origin}::${text}`;
}

function shouldMarkOutput(text) {
  const ratio = Math.max(0, Math.min(100, Number(STATE.config.outputRatio) || 0));
  if (ratio === 0) return false;
  if (ratio === 100) return true;
  return (hashString(`output::${location.href}::${text}`) % 100) < ratio;
}

function processLeafBlock(block) {
  if (block.dataset.mlgBlock === "1") return;
  if (hasBlockedAncestor(block)) return;
  const text = block.textContent || "";
  if (!text.trim() || text.trim().length < (STATE.config.minTextLength || 5)) return;
  block.dataset.mlgBlock = "1";
  block.dataset.mlgTranslating = "1";
  if (shouldMarkOutput(text.trim())) {
    block.dataset.mlgOutput = "1";
  }
  addEditButton(block);
  bindBlockHover(block);
  STATE.intersectionObserver.observe(block);
}

function queueBlockTranslate() {
  if (STATE.blockTranslateTimer) {
    clearTimeout(STATE.blockTranslateTimer);
  }
  STATE.blockTranslateTimer = setTimeout(() => {
    STATE.blockTranslateTimer = null;
    translatePendingBlocks().catch((e) => {
      console.error("[mlg:cs] translatePendingBlocks error:", e);
    });
  }, 200);
}

async function translatePendingBlocks() {
  console.log("[mlg:cs] translatePendingBlocks called", {
    enabled: STATE.config.enabled,
    models: STATE.config.models,
    pageAllowed: isPageAllowed(),
    pendingCount: STATE.pendingBlocks.length,
  });
  if (!STATE.config.enabled || !STATE.config.models || STATE.config.models.length === 0 || !isPageAllowed()) {
    STATE.pendingBlocks = [];
    return;
  }
  const pending = STATE.pendingBlocks.splice(0);
  if (pending.length === 0) return;

  // Group by source language and desired translation direction
  const enBlocks = pending.filter(b => b.lang === "en");
  const jaBlocks = pending.filter(b => b.lang === "ja");

  console.log("[mlg:cs] translating blocks", { en: enBlocks.length, ja: jaBlocks.length });

  await Promise.all([
    enBlocks.length ? translateBlockGroup(enBlocks, "en", "ja") : Promise.resolve(),
    jaBlocks.length ? translateBlockGroup(jaBlocks, "ja", "en") : Promise.resolve(),
  ]);
}

const MAX_BLOCKS_PER_BATCH = 3;
const MAX_CONCURRENT_BATCHES = 3;

async function translateBlockGroup(blocks, from, to) {
  console.log("[mlg:cs] translateBlockGroup", { from, to, blockCount: blocks.length });
  const batches = [];
  for (let i = 0; i < blocks.length; i += MAX_BLOCKS_PER_BATCH) {
    batches.push(blocks.slice(i, i + MAX_BLOCKS_PER_BATCH));
  }
  // Process up to MAX_CONCURRENT_BATCHES in parallel
  for (let i = 0; i < batches.length; i += MAX_CONCURRENT_BATCHES) {
    const chunk = batches.slice(i, i + MAX_CONCURRENT_BATCHES);
    await Promise.all(chunk.map(batch => translateBlockBatch(batch, from, to)));
  }
}

async function translateBlockBatch(blocks, from, to) {
  // Send each block's htmlParts (paragraphs) as a flat array
  // Track which parts belong to which block
  const allParts = [];
  const blockMapping = []; // { blockIndex, partCount }
  blocks.forEach((b, i) => {
    blockMapping.push({ blockIndex: i, partCount: b.htmlParts.length });
    allParts.push(...b.htmlParts);
  });

  const response = await sendMessage({
    type: "mlg:translate",
    payload: { htmlBlocks: allParts, from, to },
  });

  console.log("[mlg:cs] translateBlockBatch response:", response);

  if (!response || response.error) {
    console.error("[mlg:cs] block translate failed:", response?.error);
    // Auto-retry once silently
    if (!blocks[0]?.retried) {
      blocks.forEach(b => { b.retried = true; });
      await translateBlockBatch(blocks, from, to);
      return;
    }
    blocks.forEach(b => {
      delete b.element.dataset.mlgTranslating;
      b.element.dataset.mlgFailed = "1";
    });
    return;
  }

  // Reassemble: each "block" in the response is actually one paragraph
  const resultBlocks = response.blocks || [];
  let offset = 0;
  blockMapping.forEach(({ blockIndex, partCount }) => {
    const block = blocks[blockIndex];
    const partOffset = offset;
    offset += partCount;
    if (!block || !block.element.isConnected) {
      console.warn("[mlg:cs] block disconnected, skipping", {
        blockIndex,
        text: block?.element?.textContent?.trim().slice(0, 40) || "",
      });
      return;
    }
    const failedPartIndices = [];
    for (let p = 0; p < partCount; p++) {
      const resultIndex = partOffset + p;
      const resultBlock = resultBlocks[resultIndex];
      if (!resultBlock || !Array.isArray(resultBlock.sentences) || resultBlock.sentences.length === 0) {
        failedPartIndices.push(resultIndex);
      }
    }
    if (failedPartIndices.length > 0) {
      console.warn("[mlg:cs] block translation incomplete; marking failed", {
        blockIndex,
        failedPartIndices,
      });
      delete block.element.dataset.mlgTranslating;
      block.element.dataset.mlgFailed = "1";
      return;
    }
    // Collect sentences for each paragraph, interleaved with original separators
    const sentences = [];
    for (let p = 0; p < partCount; p++) {
      const rb = resultBlocks[partOffset + p];
      if (rb && rb.sentences) {
        sentences.push(...rb.sentences);
      }
      // Add separator after each paragraph (except the last)
      if (p < partCount - 1 && p < block.separators.length) {
        sentences.push({ source: block.separators[p], translation: block.separators[p], isSeparator: true });
      }
    }
    console.log("[mlg:cs] applying block", { blockIndex, partCount, sentenceCount: sentences.length, realSentences: sentences.filter(s => !s.isSeparator).length });
    applyBlockTranslation(block.element, sentences, from, block.atoms);
  });
}

function isMlgSentenceNode(node) {
  return node?.nodeType === Node.ELEMENT_NODE && node.dataset?.mlgSentence === "1";
}

function sentencePlainSource(sentence) {
  if (!sentence || typeof sentence.source !== "string") return "";
  const parsed = new DOMParser().parseFromString(
    sanitizeHtmlFragment(sentence.source),
    "text/html"
  );
  return parsed.body.textContent || "";
}

function applyBlockTranslation(block, sentences, sourceLang, retainedAtoms) {
  if (STATE.tooltip?.currentSpan === block) {
    hideTooltip();
  }
  const realSentences = (sentences || []).filter(s => !s.isSeparator);
  if (realSentences.length === 0) {
    // Translation failed or empty — mark as failed for retry
    delete block.dataset.mlgTranslating;
    block.dataset.mlgFailed = "1";
    return;
  }
  console.log("[mlg:cs] applyBlockTranslation", { sourceLang, sentenceCount: sentences.length });

  const stream = buildTokenStream(block, isMlgSentenceNode);
  const streamAtoms = new Map(
    stream.filter((token) => token.type === "atom").map((token) => [token.atomNumber, token.node])
  );
  const atoms = retainedAtoms instanceof Map ? retainedAtoms : streamAtoms;
  const sentenceSpans = [];
  let fromIndex = 0;

  for (let sentenceIndex = 0; sentenceIndex < realSentences.length; sentenceIndex += 1) {
    const sentence = realSentences[sentenceIndex];
    const plainSource = sentencePlainSource(sentence);
    const currentStream = sentenceIndex === 0
      ? stream
      : buildTokenStream(block, isMlgSentenceNode);
    const located = locateUnitRange(currentStream, plainSource, fromIndex);
    if (!located) {
      console.warn("[mlg:cs] unit range was not found; remaining block units were skipped", {
        sentenceIndex,
        source: plainSource,
      });
      break;
    }
    const range = document.createRange();
    range.setStart(located.startContainer, located.startOffset);
    range.setEnd(located.endContainer, located.endOffset);
    const span = wrapRange(range);
    span.dataset.mlgSentence = "1";
    span.dataset.mlgSource = plainSource;
    span.dataset.mlgTranslation = typeof sentence.translation === "string"
      ? sentence.translation
      : plainSource;
    span.dataset.mlgLang = sourceLang;
    span.__mlgBlockAtoms = atoms;
    bindInteractions(span);
    sentenceSpans.push(span);
    fromIndex = located.nextIndex;
  }

  if (sentenceSpans.length === 0) {
    delete block.dataset.mlgTranslating;
    block.dataset.mlgFailed = "1";
    return;
  }

  // Assign display languages across all sentences in this block
  assignBlockDisplayLanguages(sentenceSpans);
  sentenceSpans.forEach(applyDefaultDisplay);
  delete block.dataset.mlgTranslating;
}

// --- Root processing ---

function processRoot(root) {
  if (!STATE.config.enabled) return;
  const leafBlocks = findLeafBlocks(root);
  leafBlocks.forEach(processLeafBlock);
  checkNormaCache();
}

function checkNormaCache() {
  const normaBlocks = document.querySelectorAll("[data-mlg-output='1']");
  if (normaBlocks.length === 0) return;
  const textKeys = [];
  const blockMap = new Map();
  normaBlocks.forEach((block) => {
    const key = buildNormaKey((block.textContent || "").trim());
    textKeys.push(key);
    if (!blockMap.has(key)) blockMap.set(key, []);
    blockMap.get(key).push(block);
  });
  sendMessage({ type: "mlg:normaCheck", payload: { textKeys } }).then((result) => {
    if (!result) return;
    for (const [key, done] of Object.entries(result)) {
      if (done && blockMap.has(key)) {
        blockMap.get(key).forEach((block) => {
          delete block.dataset.mlgOutput;
        });
      }
    }
  });
}

function refreshDisplay() {
  // Re-assign display languages per block, then update each span
  const blocks = document.querySelectorAll("[data-mlg-block]");
  blocks.forEach((block) => {
    const spans = Array.from(block.querySelectorAll("span[data-mlg-sentence]"));
    if (spans.length === 0) return;
    // Clear manual overrides so ratio recalculation takes effect
    spans.forEach((span) => { delete span.dataset.mlgDisplay; });
    assignBlockDisplayLanguages(spans);
    spans.forEach((span) => { applyDefaultDisplay(span); });
  });
}

// --- Observer ---

function startObserver() {
  if (STATE.observer) return;
  STATE.observer = new MutationObserver((mutations) => {
    evaluatePageForCurrentUrl();
    const nodes = new Set();
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          nodes.add(node);
        }
      });
    });
    nodes.forEach((node) => {
      if (!hasBlockedAncestor(node)) {
        processRoot(node);
      }
    });
  });
  STATE.observer.observe(document.body, { childList: true, subtree: true });
}

function stopObserver() {
  if (STATE.observer) {
    STATE.observer.disconnect();
    STATE.observer = null;
  }
}

// --- Lifecycle ---

async function start() {
  if (STATE.started) return;
  STATE.started = true;
  startIntersectionObserver();
  processRoot(document.body);
  startObserver();
}

function stop() {
  stopObserver();
  if (STATE.intersectionObserver) {
    STATE.intersectionObserver.disconnect();
    STATE.intersectionObserver = null;
  }
  if (STATE.blockTranslateTimer) {
    clearTimeout(STATE.blockTranslateTimer);
    STATE.blockTranslateTimer = null;
  }
  STATE.pendingBlocks = [];
  const spans = document.querySelectorAll("span[data-mlg-sentence]");
  spans.forEach((span) => {
    renderSpanDisplay(span, span.dataset.mlgLang);
  });
  hideTooltip();
  // start() is a no-op while started is true, so clear it to allow a restart.
  STATE.started = false;
}

async function init() {
  STATE.config = await loadConfig();
  updatePageMatchers();
  if (STATE.config.enabled && isPageAllowed()) {
    start();
  }
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "mlg:normaDone" && message.payload?.textKey) {
      const blocks = document.querySelectorAll("[data-mlg-output='1']");
      blocks.forEach((block) => {
        if (buildNormaKey((block.textContent || "").trim()) === message.payload.textKey) {
          delete block.dataset.mlgOutput;
        }
      });
    }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) return;
    STATE.config = mergeConfig(changes[STORAGE_KEY].newValue);
    updatePageMatchers();
    const shouldTranslate = STATE.config.enabled && isPageAllowed();
    if (shouldTranslate && !STATE.started) {
      start();
    } else if (!shouldTranslate && STATE.started) {
      stop();
    } else if (shouldTranslate) {
      refreshDisplay();
    }
  });
}

// Single-page apps change the URL without reloading, which can move the page in
// or out of the opt-in/opt-out lists. The content script runs in an isolated
// world and cannot hook the page's history.pushState, so location.href is
// compared on every DOM mutation and once per second; on change the same
// start/stop decision as a settings update is applied.
let lastSeenUrl = location.href;
function evaluatePageForCurrentUrl() {
  if (location.href === lastSeenUrl) return;
  lastSeenUrl = location.href;
  if (!STATE.config) return;
  const shouldTranslate = STATE.config.enabled && isPageAllowed();
  if (shouldTranslate && !STATE.started) {
    start();
    // Blocks translated earlier were reverted to their source by stop();
    // re-apply the current mix ratio to them.
    refreshDisplay();
  } else if (!shouldTranslate && STATE.started) {
    stop();
  }
}
function watchUrlChanges() {
  window.addEventListener("popstate", evaluatePageForCurrentUrl);
  window.addEventListener("hashchange", evaluatePageForCurrentUrl);
  setInterval(evaluatePageForCurrentUrl, 1000);
}

init().then(() => {
  watchUrlChanges();
}).catch((e) => {
  console.error("[mlg:cs] init failed:", e);
});
