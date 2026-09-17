import { chromium, expect, test } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { BrowserContext, Page, Route, Worker } from "@playwright/test";

const extPath = path.resolve(".output/chrome-mv3");
const exampleUrl = "https://example.com/";
const openAiUrl = "https://api.openai.com/v1/chat/completions";

const config = {
  apiKeys: { gpt: "e2e-mock-key" },
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
};

type RouteObservation = {
  readonly externalRequestUrls: readonly string[];
  readonly mockHitCount: number;
  readonly serviceWorkerRequestCount: number;
  recordExternalRequest(url: string): void;
  recordMockRequest(isServiceWorkerRequest: boolean): void;
};

type ExtensionHarness = {
  context: BrowserContext;
  panel: Page;
  serviceWorker: Worker;
};

type RouteContext = Pick<BrowserContext, "route">;
type ServiceWorkerContext = Pick<BrowserContext, "serviceWorkers" | "waitForEvent">;
type EvaluationPage = Pick<Page, "evaluate">;
type EvaluationWorker = Pick<Worker, "evaluate">;
type LocatorPage = Pick<Page, "locator">;

const isRequestBody = (value: unknown): value is { messages?: Array<{ content?: unknown }> } =>
  typeof value === "object" && value !== null;
const isIndexBlockList = (value: unknown): value is Array<{ i: number; html: string }> =>
  Array.isArray(value);

function createRouteObservation(): RouteObservation {
  const externalRequestUrls: string[] = [];
  let mockHitCount = 0;
  let serviceWorkerRequestCount = 0;
  return {
    externalRequestUrls,
    get mockHitCount() {
      return mockHitCount;
    },
    get serviceWorkerRequestCount() {
      return serviceWorkerRequestCount;
    },
    recordExternalRequest(url) {
      externalRequestUrls.push(url);
    },
    recordMockRequest(isServiceWorkerRequest) {
      mockHitCount += 1;
      if (isServiceWorkerRequest) {
        serviceWorkerRequestCount += 1;
      }
    },
  };
}

function waitForServiceWorker(context: ServiceWorkerContext): Promise<Worker> {
  const existing = context.serviceWorkers()[0];
  return existing
    ? Promise.resolve(existing)
    : context.waitForEvent("serviceworker", { timeout: 10_000 });
}

async function fulfillOpenAiMock(
  route: Readonly<Route>,
  observation: Readonly<RouteObservation>,
): Promise<void> {
  observation.recordMockRequest(route.request().serviceWorker() !== null);
  const payload: unknown = await route.request().postDataJSON();
  const body = isRequestBody(payload) ? payload : null;
  const content = body?.messages?.[1]?.content;
  const parsed: unknown = typeof content === "string" ? JSON.parse(content) : undefined;
  const indexed = isIndexBlockList(parsed) ? parsed : [];
  const translated = indexed.map((block) => ({
    i: block.i,
    sentences: [{ source: block.html, translation: `<p>TRANSLATED ${block.i}</p>` }],
  }));
  await route.fulfill({
    body: JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ blocks: translated }) } }],
    }),
    contentType: "application/json",
  });
}

async function installNetworkDiagnostics(
  context: RouteContext,
  observation: Readonly<RouteObservation>,
): Promise<void> {
  await context.route(openAiUrl, (route) => fulfillOpenAiMock(route, observation));
  await context.route(/^https:\/\/(?!example\.com\/|api\.openai\.com\/).*/u, async (route) => {
    observation.recordExternalRequest(route.request().url());
    await route.abort();
  });
}

async function launchExtension(
  profileDir: string,
  observation: Readonly<RouteObservation>,
): Promise<ExtensionHarness> {
  const context = await chromium.launchPersistentContext(profileDir, {
    args: [
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
      // This prevents a route miss from resolving the real provider host.
      "--host-resolver-rules=MAP api.openai.com ~NOTFOUND",
    ],
    headless: false,
  });

  const serviceWorker = await waitForServiceWorker(context);
  const extensionId = new URL(serviceWorker.url()).host;
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await installNetworkDiagnostics(context, observation);

  return { context, panel, serviceWorker };
}

async function expectConfigurationReadBack(
  panel: EvaluationPage,
  serviceWorker: EvaluationWorker,
): Promise<void> {
  const saved = await panel.evaluate(async (nextConfig) => {
    await chrome.storage.local.set({ mlg_config: nextConfig });
    return (await chrome.storage.local.get("mlg_config")).mlg_config;
  }, config);
  expect(saved).toEqual(config);

  const workerReadBack = await serviceWorker.evaluate(async () => {
    return (await chrome.storage.local.get("mlg_config")).mlg_config;
  });
  expect(workerReadBack).toEqual(config);

  const backgroundResponse = await panel.evaluate(() => {
    return Promise.race([
      new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "mlg:getConfig" }, (response) => {
          resolve({
            lastError: chrome.runtime.lastError?.message,
            response,
            timedOut: false,
          });
        });
      }),
      new Promise((resolve) => {
        window.setTimeout(() => {
          resolve({ timedOut: true });
        }, 2_000);
      }),
    ]);
  });
  expect(backgroundResponse).toEqual({
    lastError: undefined,
    response: config,
    timedOut: false,
  });
}

async function expectMockRequest(observation: Readonly<RouteObservation>): Promise<void> {
  await expect.poll(() => observation.mockHitCount).toBeGreaterThan(0);
  expect(observation.serviceWorkerRequestCount).toBeGreaterThan(0);
}

async function expectDomTranslation(page: LocatorPage): Promise<void> {
  const sentence = page.locator(".mlg-sentence").first();
  await expect(sentence).toHaveAttribute("data-mlg-translation", /TRANSLATED/u, {
    timeout: 5_000,
  });
}

test("Chromium MV3のbackground→content翻訳経路を段階別に診断する", async () => {
  test.setTimeout(30_000);
  const profileDir = await mkdtemp(path.join(tmpdir(), "mazelingo-e2e-"));
  const observation = createRouteObservation();
  let context: BrowserContext | undefined;

  try {
    const harness = await launchExtension(profileDir, observation);
    context = harness.context;
    await test.step("設定保存とbackground read-back", () =>
      expectConfigurationReadBack(harness.panel, harness.serviceWorker));

    const tab = await context.newPage();
    await tab.goto(exampleUrl);
    await test.step("background listenerがcontent scriptの翻訳要求を受ける", () =>
      expectMockRequest(observation));
    await test.step("LLM mockのみを使い外部通信を遮断する", () => {
      expect(observation.externalRequestUrls).toEqual([]);
    });
    await test.step("background応答をcontent scriptがDOMへ反映する", () =>
      expectDomTranslation(tab));
  } finally {
    await context?.close();
    await rm(profileDir, { force: true, recursive: true });
  }
});
