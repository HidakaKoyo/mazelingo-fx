/**
 * Build script for Chrome Web Store distribution.
 * Minifies JS files and creates a zip package.
 *
 * Usage: node build.js
 */

import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from "fs";
import { execFileSync, execSync } from "child_process";
import { minify } from "terser";
import { join } from "path";

const DIST_DIR = "dist";
const ZIP_NAME = "mazelingo.zip";

const JS_FILES = [
  "background.js",
  "dom-overlay.js",
  "content_script.js",
  "config.js",
  "llm.js",
  "options.js",
  "popup.js",
];

const COPY_FILES = [
  "manifest.json",
  "options.html",
  "popup.html",
  "content_style.css",
  "vocab_data.json",
  "situations.json",
];

const COPY_DIRS = [
  "icons",
];

async function build() {
  // Clean dist
  if (existsSync(DIST_DIR)) {
    rmSync(DIST_DIR, { recursive: true });
  }
  mkdirSync(DIST_DIR);

  // Minify JS files
  for (const file of JS_FILES) {
    const src = readFileSync(file, "utf8");
    const result = await minify(src, {
      module: true,
      compress: {
        drop_console: true,
        passes: 2,
      },
      mangle: true,
      format: {
        comments: false,
      },
    });
    writeFileSync(join(DIST_DIR, file), result.code);
    const ratio = Math.round((1 - result.code.length / src.length) * 100);
    console.log(`  ${file}: ${src.length} → ${result.code.length} bytes (${ratio}% smaller)`);
  }

  // Copy static files
  for (const file of COPY_FILES) {
    cpSync(file, join(DIST_DIR, file));
  }

  // Copy directories
  for (const dir of COPY_DIRS) {
    cpSync(dir, join(DIST_DIR, dir), { recursive: true });
  }

  // Create zip
  if (existsSync(ZIP_NAME)) {
    rmSync(ZIP_NAME);
  }
  if (process.platform === "win32") {
    execFileSync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `Compress-Archive -Path '${DIST_DIR}\\*' -DestinationPath '${ZIP_NAME}' -Force`,
    ]);
  } else {
    execSync(`cd ${DIST_DIR} && zip -r ../${ZIP_NAME} .`);
  }
  const zipSize = readFileSync(ZIP_NAME).length;
  console.log(`\n  ${ZIP_NAME}: ${Math.round(zipSize / 1024)} KB`);
  console.log("  Done!");
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
