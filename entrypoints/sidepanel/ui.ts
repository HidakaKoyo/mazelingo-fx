import { elements } from "./el";

export type Tab = "settings" | "output" | "explanation";

export function switchTab(tab: Tab): void {
  const isSettings = tab === "settings";
  const isOutput = tab === "output";
  const isExplanation = tab === "explanation";
  elements.tabSettings.classList.toggle("is-active", isSettings);
  elements.tabOutput.classList.toggle("is-active", isOutput);
  elements.tabExplanation.classList.toggle("is-active", isExplanation);
  elements.tabContentSettings.classList.toggle("is-active", isSettings);
  elements.tabContentOutput.classList.toggle("is-active", isOutput);
  elements.tabContentExplanation.classList.toggle("is-active", isExplanation);
  elements.save.style.display = isSettings ? "" : "none";
}
