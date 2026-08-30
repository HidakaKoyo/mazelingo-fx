import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "wxt";

const isFirefoxLab = process.env.MAZELINGO_FIREFOX_LAB === "1";
const firefoxLabProfile = join(homedir(), ".mazelingo-fx", "firefox-lab");

if (isFirefoxLab) {
  mkdirSync(firefoxLabProfile, { recursive: true });
}

const ICONS = {
  128: "icons/icon128.png",
  16: "icons/icon16.png",
  32: "icons/icon32.png",
  48: "icons/icon48.png",
} as const;

export default defineConfig({
  webExt: isFirefoxLab
    ? {
        firefoxProfile: firefoxLabProfile,
        keepProfileChanges: true,
      }
    : undefined,
  manifest: ({ browser }) => {
    const isFirefox = browser === "firefox";
    return {
      action: {
        default_icon: ICONS,
        default_title: "Mazelingo",
      },
      description: "Sentence-level bilingual mix translator.",
      host_permissions: ["<all_urls>"],
      icons: ICONS,
      name: "Mazelingo-FX",
      permissions: isFirefox
        ? ["storage", "activeTab", "tabs"]
        : ["storage", "sidePanel", "activeTab", "tabs"],
      ...(isFirefox
        ? {
            browser_specific_settings: {
              gecko: {
                data_collection_permissions: {
                  required: ["authenticationInfo", "websiteContent"],
                },
                id: "mazelingo-fx@hidakakoyo.github.io",
                strict_min_version: "140.0",
              },
            },
            sidebar_action: {
              default_icon: "icons/icon128.png",
              default_panel: "sidepanel.html",
              default_title: "Mazelingo",
            },
          }
        : {
            side_panel: {
              default_path: "sidepanel.html",
            },
          }),
      web_accessible_resources: [
        {
          resources: ["vocab_data.json", "situations.json"],
          matches: ["<all_urls>"],
        },
      ],
    };
  },
  zip: {
    name: "mazelingo-fx",
  },
});
