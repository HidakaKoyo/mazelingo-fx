/* eslint-disable typescript/no-unsafe-argument, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return, typescript/strict-boolean-expressions -- Parsed manifest JSON is structurally validated below. */
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_CHROME_MANIFEST = ".output/chrome-mv3/manifest.json";
const DEFAULT_FIREFOX_MANIFEST = ".output/firefox-mv3/manifest.json";

/**
 * @param {boolean} condition
 * @param {string} message
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function hasOwn(object, property) {
  return Object.prototype.hasOwnProperty.call(object, property);
}

export function verifyChromeManifest(manifest) {
  assert(manifest.manifest_version === 3, "Chrome manifest must use Manifest V3");
  assert(
    manifest.side_panel?.default_path === "sidepanel.html",
    "Chrome manifest side_panel.default_path must be sidepanel.html",
  );
  assert(
    Array.isArray(manifest.permissions) && manifest.permissions.includes("sidePanel"),
    "Chrome manifest must request the sidePanel permission",
  );
  assert(
    manifest.background?.service_worker === "background.js",
    "Chrome manifest background.service_worker must be background.js",
  );
  assert(!hasOwn(manifest, "sidebar_action"), "Chrome manifest must not define sidebar_action");
}

export function verifyFirefoxManifest(manifest) {
  assert(manifest.manifest_version === 3, "Firefox manifest must use Manifest V3");
  assert(
    manifest.sidebar_action?.default_panel === "sidepanel.html",
    "Firefox manifest sidebar_action.default_panel must be sidepanel.html",
  );
  assert(
    Array.isArray(manifest.background?.scripts) &&
      manifest.background.scripts.length === 1 &&
      manifest.background.scripts[0] === "background.js",
    "Firefox manifest background.scripts must contain only background.js",
  );
  assert(!hasOwn(manifest, "side_panel"), "Firefox manifest must not define side_panel");
  assert(
    !hasOwn(manifest.background ?? {}, "service_worker"),
    "Firefox manifest must not define background.service_worker",
  );
  assert(
    !Array.isArray(manifest.permissions) ||
      !manifest.permissions.some((permission) => permission === "sidePanel"),
    "Firefox manifest must not request the sidePanel permission",
  );
  const readerCommand = manifest.commands?.["reader-translate-page"];
  assert(
    readerCommand?.suggested_key?.default === "Ctrl+Shift+U",
    "Firefox manifest must define the reader-translate-page shortcut",
  );
  const geckoSettings = manifest.browser_specific_settings?.gecko;
  assert(
    typeof geckoSettings?.id === "string" && geckoSettings.id.length > 0,
    "Firefox manifest must define a Gecko extension ID",
  );
  assert(
    Number(geckoSettings?.strict_min_version) >= 140,
    "Firefox manifest must require Firefox 140 or later for built-in data consent",
  );
  const requiredData = geckoSettings?.data_collection_permissions?.required;
  assert(
    Array.isArray(requiredData) &&
      requiredData.includes("authenticationInfo") &&
      requiredData.includes("websiteContent"),
    "Firefox manifest must disclose authenticationInfo and websiteContent transmission",
  );
}

/** @param {string} path */
async function readManifest(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function verifyRequiredArtifacts(manifestPath, browserName) {
  const outputDirectory = dirname(manifestPath);

  await Promise.all(
    ["sidepanel.html", "background.js"].map(async (artifact) => {
      try {
        await access(resolve(outputDirectory, artifact));
      } catch {
        throw new Error(`${browserName} build must contain ${artifact}`);
      }
    }),
  );
}

export async function verifyManifestFiles({
  chromeManifestPath = DEFAULT_CHROME_MANIFEST,
  firefoxManifestPath = DEFAULT_FIREFOX_MANIFEST,
} = {}) {
  const [chromeManifest, firefoxManifest] = await Promise.all([
    readManifest(chromeManifestPath),
    readManifest(firefoxManifestPath),
  ]);

  verifyChromeManifest(chromeManifest);
  verifyFirefoxManifest(firefoxManifest);
  await Promise.all([
    verifyRequiredArtifacts(chromeManifestPath, "Chrome"),
    verifyRequiredArtifacts(firefoxManifestPath, "Firefox"),
  ]);
}

async function main() {
  const [
    chromeManifestPath = DEFAULT_CHROME_MANIFEST,
    firefoxManifestPath = DEFAULT_FIREFOX_MANIFEST,
  ] = process.argv.slice(2);

  await verifyManifestFiles({ chromeManifestPath, firefoxManifestPath });
  console.log("Generated Chrome and Firefox manifests are valid.");
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
