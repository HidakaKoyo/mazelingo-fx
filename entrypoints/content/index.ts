import { defineContentScript } from "wxt/utils/define-content-script";
import * as _style from "./style.css";
import { init } from "./lifecycle";

export default defineContentScript({
  cssInjectionMode: "manifest",
  main() {
    void init().catch((e: unknown) => {
      console.error("[mlg:cs] init failed:", e);
    });
  },
  matches: ["<all_urls>"],
  runAt: "document_idle",
});
