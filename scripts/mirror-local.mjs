// Mirror the built extension (.output/chrome-mv3) into the repository root.
//
// Chrome derives an unpacked extension's id from the directory it was loaded
// from, and chrome.storage (API keys, settings, translation cache) is keyed by
// that id. Loading the build from the repo root keeps the id that was in use
// before the WXT migration, so nothing has to be re-entered. Run via
// `npm run build:local`, then press "Reload" on chrome://extensions.
import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const src = join(process.cwd(), ".output", "chrome-mv3");
if (!existsSync(join(src, "manifest.json"))) {
  console.error("No build found at .output/chrome-mv3 — run `wxt build` first.");
  process.exit(1);
}
for (const name of readdirSync(src)) {
  const dest = join(process.cwd(), name);
  rmSync(dest, { recursive: true, force: true });
  cpSync(join(src, name), dest, { recursive: true });
}
console.log(`Mirrored ${readdirSync(src).length} entries from .output/chrome-mv3 to the repo root.`);
