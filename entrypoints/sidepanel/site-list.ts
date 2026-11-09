import { browser } from "wxt/browser";
import { addPagePattern, getSitePattern } from "@/utils/page-patterns";
import { updateDirtyState } from "./config";

export async function addCurrentSiteTo(textarea: HTMLTextAreaElement): Promise<void> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.url === undefined) return;
  textarea.value = addPagePattern(textarea.value, getSitePattern(tab.url));
  textarea.scrollTop = textarea.scrollHeight;
  updateDirtyState();
}
