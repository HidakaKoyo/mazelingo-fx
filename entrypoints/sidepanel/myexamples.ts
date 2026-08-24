import { browser } from "wxt/browser";
import { MY_EXAMPLES_KEY } from "@/utils/keys";
import { elements, escapeHtml } from "./el";
import { isClosest, selectedTtsVoice, type DeepReadonly } from "./util";
import { tts } from "./rpc";

interface MyExample {
  id: number;
  question: string;
  answers: string[];
}

let myExamples: MyExample[] = [];
let myExTtsCache: Record<string, string> = {};
let myExTtsPlaying: HTMLAudioElement | null = null;

async function playMyExTts(text: string, btn: HTMLButtonElement): Promise<void> {
  if (myExTtsPlaying !== null) {
    myExTtsPlaying.pause();
    myExTtsPlaying = null;
  }
  if (myExTtsCache[text] !== undefined) {
    myExTtsPlaying = new Audio(myExTtsCache[text]);
    void myExTtsPlaying.play();
    return;
  }
  btn.disabled = true;
  btn.textContent = "…";
  const res = await tts(text, selectedTtsVoice());
  btn.disabled = false;
  btn.innerHTML = "&#9655;";
  if (res !== undefined && res.error === undefined && res.dataUrl !== undefined) {
    myExTtsCache[text] = res.dataUrl;
    myExTtsPlaying = new Audio(res.dataUrl);
    void myExTtsPlaying.play();
  }
}

export function isMyExampleArray(x: unknown): x is MyExample[] {
  return Array.isArray(x);
}

export async function loadMyExamples(): Promise<void> {
  const result = await browser.storage.local.get(MY_EXAMPLES_KEY);
  const raw: unknown = result[MY_EXAMPLES_KEY];
  myExamples = isMyExampleArray(raw) ? raw : [];
  renderMyExamples();
}

async function saveMyExamples(): Promise<void> {
  await browser.storage.local.set({ [MY_EXAMPLES_KEY]: myExamples });
}

export async function addMyExample(question: string, answers: readonly string[]): Promise<void> {
  myExamples.push({ answers: [...answers], id: Date.now(), question });
  await saveMyExamples();
  renderMyExamples();
}

async function removeMyExample(id: number): Promise<void> {
  myExamples = myExamples.filter((ex: DeepReadonly<MyExample>) => ex.id !== id);
  await saveMyExamples();
  renderMyExamples();
}

function buildMyExamplesHtml(): string {
  const h = escapeHtml;
  return myExamples
    .map((ex: DeepReadonly<MyExample>) => {
      const answersHtml = ex.answers
        .map(
          (a) =>
            `<div class="my-ex-answer"><span class="my-ex-answer-text">${h(a)}</span><button class="my-ex-tts-btn" data-tts="${h(a)}" title="再生">&#9655;</button></div>`,
        )
        .join("");
      return `<div class="my-ex-item" data-id="${ex.id}">
      <div class="my-ex-question">
        <span class="my-ex-question-text">${h(ex.question)}</span>
        <button class="my-ex-tts-btn" data-tts="${h(ex.question)}" title="再生">&#9655;</button>
        <span class="my-ex-toggle">▼</span>
      </div>
      <div class="my-ex-answers">
        ${answersHtml}
        <div style="text-align:right;margin-top:4px;"><button class="my-ex-delete" data-id="${ex.id}" title="削除">&times;</button></div>
      </div>
    </div>`;
    })
    .join("");
}

function bindMyExamplesHandlers(): void {
  elements.myExamplesList.querySelectorAll<HTMLElement>(".my-ex-question").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (isClosest(e.target, ".my-ex-tts-btn")) {
        return;
      }
      const item = el.closest(".my-ex-item");
      if (item !== null) {
        item.classList.toggle("is-open");
      }
    });
  });

  elements.myExamplesList.querySelectorAll<HTMLElement>(".my-ex-delete").forEach((btn) => {
    btn.addEventListener("click", () => {
      void removeMyExample(Number(btn.dataset.id));
    });
  });

  elements.myExamplesList.querySelectorAll<HTMLButtonElement>(".my-ex-tts-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const text = btn.dataset.tts;
      if (text !== undefined && text !== "") {
        void playMyExTts(text, btn);
      }
    });
  });
}

function renderMyExamples(): void {
  if (myExamples.length === 0) {
    elements.myExamplesList.innerHTML = "";
    return;
  }
  elements.myExamplesList.innerHTML = buildMyExamplesHtml();
  bindMyExamplesHandlers();
}
