import { defineConfig } from "@playwright/test";

// E2E tests load the built extension from `.output/chrome-mv3` (the same
// Directory `wxt build` produces) and drive a real Chrome via a persistent
// Context. The extension path is passed by `e2e/mazelingo.spec.ts`; the CI job
// Runs this under xvfb (see .github/workflows/ci.yml) so Chrome can stay headed.
export default defineConfig({
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        launchOptions: {
          headless: false,
          args: [
            "--disable-extensions-except=.output/chrome-mv3",
            "--load-extension=.output/chrome-mv3",
          ],
        },
      },
    },
  ],
  retries: 1,
  testDir: "./e2e",
  timeout: 60000,
  use: {
    trace: "on-first-retry",
  },
});
