import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";

// Pure logic runs in the default node environment.
// DOM-heavy content logic uses in-source testing (`if (import.meta.vitest)`).
// LLM calls are mocked via `vi.mock` so no live API keys are needed.
//
// Browser-mode Playwright E2E lives in `e2e/` and is run with
// `npx playwright test` against the built `.output/chrome-mv3` directory.
export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    globals: true,
    include: ["utils/**/*.{test,spec}.ts", "entrypoints/**/*.{test,spec}.ts"],
    // Allow in-source tests: `if (import.meta.vitest) { ... }` inside source files.
    includeSource: ["utils/**/*.ts", "entrypoints/content/**/*.ts"],
    environment: "node",
  },
});
