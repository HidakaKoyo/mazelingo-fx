import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    action: {
      default_icon: {
        128: "icons/icon128.png",
        16: "icons/icon16.png",
        32: "icons/icon32.png",
        48: "icons/icon48.png",
      },
      default_title: "Mazelingo",
    },
    description: "Sentence-level bilingual mix translator.",
    host_permissions: ["<all_urls>"],
    icons: {
      128: "icons/icon128.png",
      16: "icons/icon16.png",
      32: "icons/icon32.png",
      48: "icons/icon48.png",
    },
    name: "Mazelingo",
    permissions: ["storage", "sidePanel", "activeTab", "tabs"],
    side_panel: {
      default_path: "sidepanel.html",
    },
    web_accessible_resources: [
      {
        resources: ["vocab_data.json", "situations.json"],
        matches: ["<all_urls>"],
      },
    ],
  },
  zip: {
    // WXT builds a `mazelingo.zip` artifact for Chrome Web Store distribution.
    name: "mazelingo",
  },
});
