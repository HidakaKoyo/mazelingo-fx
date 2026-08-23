import type { MlgSpan } from "@/utils/dom-overlay";

export const TTS_SPEAKER_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></svg>`;
export const TTS_PLAY_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
export const TTS_PAUSE_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
export const TTS_LOADING_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2a10 10 0 0110 10" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></path></svg>`;

export interface TtsState {
  btn: HTMLButtonElement | null;
  hoverActions: HTMLElement | null;
  popup: HTMLElement | null;
  audio: HTMLAudioElement | null;
  btnSpan: MlgSpan | null;
  hideTimer: ReturnType<typeof setTimeout> | null;
  showTimer: ReturnType<typeof setTimeout> | null;
}

export const tts: TtsState = {
  audio: null,
  btn: null,
  btnSpan: null,
  hideTimer: null,
  hoverActions: null,
  popup: null,
  showTimer: null,
};
