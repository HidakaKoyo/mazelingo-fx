import { chromium, expect, test } from "@playwright/test";
import path from "node:path";
import type { BrowserContext, Page, Route } from "@playwright/test";

const extPath = path.resolve(".output/chrome-mv3");

const isRequestBody = (value: unknown): value is { messages?: Array<{ content?: unknown }> } =>
  typeof value === "object" && value !== null;
const isIndexBlockList = (value: unknown): value is Array<{ i: number; html: string }> =>
  Array.isArray(value);

/**
 * E2E smoke: load the built extension, mock the LLM API so no real API key is
 * needed, seed a config that translates all https pages, and assert that the
 * content script actually wraps sentences and renders the mocked translation.
 *
 * This mirrors the manual DevTools verification: extension loads → config set →
 * open example.com → content script injects `.mlg-sentence` spans with the
 * LLM-provided translation.
 */
async function launchExtension(): Promise<{ context: BrowserContext; page: Page }> {
  const context = await chromium.launchPersistentContext("/tmp/opencode/e2e-e2e-profile", {
    args: [`--disable-extensions-except=${extPath}`, `--load-extension=${extPath}`],
    headless: false,
  });

  // Intercept the LLM API. Playwright matches routes in reverse registration
  // order, so register broad first, specific last.
  await context.route("**/v1/**", async (route: Readonly<Route>) => {
    const payload: unknown = await route.request().postDataJSON();
    const body = isRequestBody(payload) ? payload : null;
    const content = body?.messages?.[1]?.content;
    const parsed: unknown = typeof content === "string" ? JSON.parse(content) : undefined;
    const indexed = isIndexBlockList(parsed) ? parsed : [];
    const translated = indexed.map((b: { readonly i: number; readonly html: string }) => ({
      i: b.i,
      sentences: [{ source: b.html, translation: `<p>TRANSLATED ${b.i}</p>` }],
    }));
    await route.fulfill({
      body: JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ blocks: translated }) } }],
      }),
      contentType: "application/json",
    });
  });

  return { context, page: await getExtensionPage(context) };
}

async function getExtensionPage(context: BrowserContext): Promise<Page> {
  // Wait for the background service worker to spawn so we know the extension id.
  let serviceWorker = context.serviceWorkers()[0];
  serviceWorker ??= await context.waitForEvent("serviceworker");
  const bg = await context.newPage(),
    extensionId = serviceWorker.url().split("/")[2];
  await bg.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await bg.evaluate(() => {
    void chrome.storage.local.set({
      mlg_config: {
        apiKeys: { gpt: "sk-mock" },
        enabled: true,
        englishRatio: 50,
        minTextLength: 2,
        mixLanguage: true,
        models: ["gpt-5.2"],
        outputRatio: 20,
        pageListExclude: "",
        pageListInclude: "https://*",
        translateButtons: false,
        ttsVoice: "nova",
      },
    });
  });
  await bg.waitForTimeout(300);
  return bg;
}

test("content script wraps sentences and renders the mocked translation", async () => {
  const { context, page: _page } = await launchExtension(),
    tab = await context.newPage();
  await tab.goto("https://example.com");
  await tab.waitForTimeout(3500);

  const spans = await tab.evaluate(() => document.querySelectorAll(".mlg-sentence").length);
  expect(spans).toBeGreaterThan(0);

  const firstSpan = await tab.evaluate(() => {
    const s = document.querySelector<HTMLElement>(".mlg-sentence");
    return s ? { text: s.textContent, translation: s.dataset.mlgTranslation } : null;
  });
  expect(firstSpan).not.toBeNull();
  expect(firstSpan?.translation).toContain("TRANSLATED");

  await context.close();
});
