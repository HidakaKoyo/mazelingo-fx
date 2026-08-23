import { browser } from "wxt/browser";
import type { MlgMessage } from "@/utils/messages";
import { showOutputForm } from "./output";
import { showExplanation } from "./explanation";
import { getPendingExplanation } from "./rpc";
import type { DeepReadonly } from "./util";

export function initMessages(): void {
  browser.runtime.onMessage.addListener((message: DeepReadonly<MlgMessage>) => {
    if (message.type === "mlg:openOutput") {
      const text = message.payload.text;
      if (text !== undefined && text !== "") {
        showOutputForm(text, message.payload.origin ?? "");
      }
    }
    if (message.type === "mlg:openExplanation") {
      const text = message.payload.text;
      if (text !== undefined && text !== "") {
        void showExplanation(message.payload);
      }
    }
  });
}

export async function initPendingExplanation(): Promise<void> {
  const pendingExplanation = await getPendingExplanation();
  if (
    pendingExplanation !== undefined &&
    pendingExplanation.text !== undefined &&
    pendingExplanation.text !== ""
  ) {
    void showExplanation(pendingExplanation);
  }
}
