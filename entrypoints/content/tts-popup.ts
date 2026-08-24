import { stripHtmlTags } from "@/utils/content-logic";
import type { MlgSpan } from "@/utils/dom-overlay";
import { getEnglishText } from "./text";
import { STATE, isRuntimeError, sendMessage } from "./state";
import type { MlgTtsResponse, RuntimeError } from "./state";
import { TTS_LOADING_SVG, TTS_PAUSE_SVG, TTS_PLAY_SVG, tts } from "./tts-state";

interface TtsUi {
  popup: HTMLElement;
  playBtn: HTMLButtonElement;
  seekBar: HTMLInputElement;
  timeEl: HTMLSpanElement;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function refreshPlayButton(): void {
  if (!tts.audio) {
    return;
  }
  const playBtn = tts.hoverActions?.querySelector(".mlg-tts-popup-play");
  if (playBtn instanceof HTMLButtonElement) {
    playBtn.innerHTML = tts.audio.paused ? TTS_PLAY_SVG : TTS_PAUSE_SVG;
  }
}

function buildTtsPopup(span: MlgSpan): TtsUi {
  const popup = document.createElement("div");
  popup.className = "mlg-tts-popup";
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
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeTtsPopup();
  });
  popup.append(playBtn, seekBar, timeEl, closeBtn);
  document.body.append(popup);
  const rects = span.getClientRects();
  const rect =
    rects.length > 0 ? (rects[0] ?? span.getBoundingClientRect()) : span.getBoundingClientRect();
  popup.style.top = `${rect.top + window.scrollY - popup.offsetHeight - 8}px`;
  popup.style.left = `${Math.max(4, rect.left + window.scrollX)}px`;
  return { popup, playBtn, seekBar, timeEl };
}

function watchOutsideClick(): void {
  const onOutsideClick = (e: Event): void => {
    if (tts.popup && !(e.target instanceof Node && tts.popup.contains(e.target))) {
      closeTtsPopup();
      document.removeEventListener("click", onOutsideClick, true);
    }
  };
  setTimeout(() => {
    document.addEventListener("click", onOutsideClick, true);
  }, 0);
}

function wireAudioControls(
  playBtn: HTMLButtonElement,
  seekBar: HTMLInputElement,
  timeEl: HTMLSpanElement,
): void {
  if (!tts.audio) {
    return;
  }
  let seeking = false;
  wireSeekBar(
    seekBar,
    timeEl,
    () => seeking,
    (v) => {
      seeking = v;
    },
  );
  wirePlayButton(playBtn);
}

function wireSeekBar(
  seekBar: HTMLInputElement,
  timeEl: HTMLSpanElement,
  isSeeking: () => boolean,
  setSeeking: (v: boolean) => void,
): void {
  if (!tts.audio) {
    return;
  }
  tts.audio.addEventListener("timeupdate", () => {
    if (!tts.audio || isSeeking()) {
      return;
    }
    const pct = tts.audio.duration ? (tts.audio.currentTime / tts.audio.duration) * 100 : 0;
    seekBar.value = String(pct);
    timeEl.textContent = formatTime(tts.audio.currentTime);
  });
  tts.audio.addEventListener("ended", () => {
    refreshPlayButton();
  });
  tts.audio.addEventListener("pause", () => {
    refreshPlayButton();
  });
  tts.audio.addEventListener("play", () => {
    refreshPlayButton();
  });
  seekBar.addEventListener("input", () => {
    setSeeking(true);
    if (tts.audio && tts.audio.duration) {
      timeEl.textContent = formatTime((Number(seekBar.value) / 100) * tts.audio.duration);
    }
  });
  seekBar.addEventListener("change", () => {
    if (tts.audio && tts.audio.duration) {
      tts.audio.currentTime = (Number(seekBar.value) / 100) * tts.audio.duration;
    }
    setSeeking(false);
  });
}

function wirePlayButton(playBtn: HTMLButtonElement): void {
  if (!tts.audio) {
    return;
  }
  playBtn.addEventListener("click", () => {
    if (!tts.audio) {
      return;
    }
    if (tts.audio.paused) {
      if (tts.audio.ended) {
        tts.audio.currentTime = 0;
      }
      void tts.audio.play();
    } else {
      tts.audio.pause();
    }
  });
}

function attachTtsAudio(
  head: Readonly<TtsUi>,
  span: MlgSpan,
  res: Readonly<MlgTtsResponse> | RuntimeError | null | undefined,
): boolean {
  if (!tts.popup) {
    return false;
  }
  if (!res || isRuntimeError(res)) {
    head.playBtn.classList.remove("is-loading");
    head.playBtn.innerHTML = "!";
    head.playBtn.title = res?.error ?? "TTS failed";
    return false;
  }
  tts.audio = new Audio(res.dataUrl);
  head.playBtn.classList.remove("is-loading");
  head.playBtn.innerHTML = TTS_PLAY_SVG;
  wireAudioControls(head.playBtn, head.seekBar, head.timeEl);
  span.classList.add("is-playing");
  tts.audio.addEventListener("ended", () => {
    span.classList.remove("is-playing");
  });
  void tts.audio.play();
  return true;
}

export function openTtsPopup(span: MlgSpan): void {
  closeTtsPopup();
  const englishText = getEnglishText(span);
  const text = stripHtmlTags(englishText);
  if (!text) {
    return;
  }
  const head = buildTtsPopup(span);
  tts.popup = head.popup;
  watchOutsideClick();
  void sendMessage<MlgTtsResponse>({
    payload: { text, voice: STATE.config.ttsVoice },
    type: "mlg:tts",
  }).then((res) => attachTtsAudio(head, span, res));
}

export function closeTtsPopup(): void {
  document.querySelectorAll(".mlg-sentence.is-playing").forEach((el) => {
    el.classList.remove("is-playing");
  });
  if (tts.audio) {
    tts.audio.pause();
    tts.audio = null;
  }
  if (tts.popup !== null) {
    tts.popup.remove();
    tts.popup = null;
  }
}
