/* eslint-disable typescript/no-confusing-void-expression, typescript/no-floating-promises, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access -- node:test owns and awaits registered test callbacks; this JavaScript test has no imported Node type metadata. */
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  verifyChromeManifest,
  verifyFirefoxManifest,
  verifyManifestFiles,
} from "./verify-manifests.mjs";

const validChromeManifest = {
  manifest_version: 3,
  permissions: ["storage", "sidePanel"],
  side_panel: { default_path: "sidepanel.html" },
  background: { service_worker: "background.js" },
};

const validFirefoxManifest = {
  manifest_version: 3,
  permissions: ["storage"],
  sidebar_action: { default_panel: "sidepanel.html" },
  background: { scripts: ["background.js"] },
  browser_specific_settings: {
    gecko: {
      id: "mazelingo-fx@example.org",
      strict_min_version: "140.0",
      data_collection_permissions: {
        required: ["authenticationInfo", "websiteContent"],
      },
    },
  },
};

test("accepts browser-specific MV3 manifests", () => {
  assert.doesNotThrow(() => verifyChromeManifest(validChromeManifest));
  assert.doesNotThrow(() => verifyFirefoxManifest(validFirefoxManifest));
});

test("rejects Firefox manifests containing Chrome-only fields", () => {
  assert.throws(
    () => verifyFirefoxManifest({ ...validFirefoxManifest, side_panel: {} }),
    /must not define side_panel/u,
  );
  assert.throws(
    () =>
      verifyFirefoxManifest({
        ...validFirefoxManifest,
        background: { ...validFirefoxManifest.background, service_worker: "background.js" },
      }),
    /must not define background\.service_worker/u,
  );
  assert.throws(
    () => verifyFirefoxManifest({ ...validFirefoxManifest, permissions: ["sidePanel"] }),
    /must not request the sidePanel permission/u,
  );
});

test("rejects Firefox manifests without MV3 sidebar background scripts", () => {
  assert.throws(
    () => verifyFirefoxManifest({ ...validFirefoxManifest, manifest_version: 2 }),
    /must use Manifest V3/u,
  );
  assert.throws(
    () => verifyFirefoxManifest({ ...validFirefoxManifest, sidebar_action: undefined }),
    /sidebar_action\.default_panel must be sidepanel\.html/u,
  );
  assert.throws(
    () => verifyFirefoxManifest({ ...validFirefoxManifest, background: {} }),
    /background\.scripts must contain only background\.js/u,
  );
  assert.throws(
    () => verifyFirefoxManifest({ ...validFirefoxManifest, sidebar_action: {} }),
    /sidebar_action\.default_panel must be sidepanel\.html/u,
  );
  assert.throws(
    () =>
      verifyFirefoxManifest({
        ...validFirefoxManifest,
        sidebar_action: { default_panel: "wrong.html" },
      }),
    /sidebar_action\.default_panel must be sidepanel\.html/u,
  );
  assert.throws(
    () =>
      verifyFirefoxManifest({
        ...validFirefoxManifest,
        background: { scripts: ["wrong.js"] },
      }),
    /background\.scripts must contain only background\.js/u,
  );
});

test("rejects Firefox manifests without signing and data consent metadata", () => {
  assert.throws(
    () => verifyFirefoxManifest({ ...validFirefoxManifest, browser_specific_settings: {} }),
    /must define a Gecko extension ID/u,
  );
  assert.throws(
    () =>
      verifyFirefoxManifest({
        ...validFirefoxManifest,
        browser_specific_settings: {
          gecko: {
            ...validFirefoxManifest.browser_specific_settings.gecko,
            strict_min_version: "139.0",
          },
        },
      }),
    /must require Firefox 140/u,
  );
  assert.throws(
    () =>
      verifyFirefoxManifest({
        ...validFirefoxManifest,
        browser_specific_settings: {
          gecko: {
            ...validFirefoxManifest.browser_specific_settings.gecko,
            data_collection_permissions: { required: ["websiteContent"] },
          },
        },
      }),
    /must disclose authenticationInfo and websiteContent/u,
  );
});

test("rejects Chrome manifests without MV3 side panel service worker fields", () => {
  assert.throws(
    () => verifyChromeManifest({ ...validChromeManifest, manifest_version: 2 }),
    /must use Manifest V3/u,
  );
  assert.throws(
    () => verifyChromeManifest({ ...validChromeManifest, side_panel: undefined }),
    /side_panel\.default_path must be sidepanel\.html/u,
  );
  assert.throws(
    () => verifyChromeManifest({ ...validChromeManifest, background: {} }),
    /background\.service_worker must be background\.js/u,
  );
  assert.throws(
    () => verifyChromeManifest({ ...validChromeManifest, sidebar_action: {} }),
    /must not define sidebar_action/u,
  );
  assert.throws(
    () => verifyChromeManifest({ ...validChromeManifest, side_panel: {} }),
    /side_panel\.default_path must be sidepanel\.html/u,
  );
  assert.throws(
    () =>
      verifyChromeManifest({
        ...validChromeManifest,
        side_panel: { default_path: "wrong.html" },
      }),
    /side_panel\.default_path must be sidepanel\.html/u,
  );
  assert.throws(
    () =>
      verifyChromeManifest({
        ...validChromeManifest,
        background: { service_worker: "wrong.js" },
      }),
    /background\.service_worker must be background\.js/u,
  );
  assert.throws(
    () => verifyChromeManifest({ ...validChromeManifest, permissions: ["storage"] }),
    /must request the sidePanel permission/u,
  );
});

test("rejects generated manifests when a required artifact is missing", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "mazelingo-manifests-"));
  const chromeDirectory = join(fixtureRoot, "chrome-mv3");
  const firefoxDirectory = join(fixtureRoot, "firefox-mv3");

  try {
    await Promise.all([mkdir(chromeDirectory), mkdir(firefoxDirectory)]);
    await Promise.all([
      writeFile(join(chromeDirectory, "manifest.json"), JSON.stringify(validChromeManifest)),
      writeFile(join(firefoxDirectory, "manifest.json"), JSON.stringify(validFirefoxManifest)),
      writeFile(join(chromeDirectory, "sidepanel.html"), ""),
      writeFile(join(chromeDirectory, "background.js"), ""),
      writeFile(join(firefoxDirectory, "sidepanel.html"), ""),
    ]);

    await assert.rejects(
      verifyManifestFiles({
        chromeManifestPath: join(chromeDirectory, "manifest.json"),
        firefoxManifestPath: join(firefoxDirectory, "manifest.json"),
      }),
      /Firefox build must contain background\.js/u,
    );
  } finally {
    await rm(fixtureRoot, { force: true, recursive: true });
  }
});
