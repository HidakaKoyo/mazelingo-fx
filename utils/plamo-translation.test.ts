import { afterEach, describe, expect, it, vi } from "vitest";
import { LOCAL_REQUEST_TIMEOUT_MS } from "./local-endpoint";
import { buildPfml3Prompt, translatePlamoUncached } from "./plamo-translation";

const config = {
  localEndpoint: { apiKey: "", baseUrl: "http://127.0.0.1:8765/v1" },
  plamoModel: "default_model",
};

function completion(text: string): Response {
  return new Response(JSON.stringify({ choices: [{ text }] }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requestBody(call: readonly unknown[]): Record<string, unknown> {
  const options: unknown = call[1];
  if (typeof options !== "object" || options === null || !("body" in options)) return {};
  const parsed: unknown = JSON.parse(String(options.body));
  return isRecord(parsed) ? parsed : {};
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("buildPfml3Prompt", () => {
  it("builds PFML3 without whitespace, newlines, or BOS", () => {
    expect(buildPfml3Prompt("Hello", "en", "ja", "Previous")).toBe(
      "<|plamo:tag|>dataset<|plamo:msg|>translation" +
        "<|plamo:tag|>context<|plamo:msg|>Previous" +
        "<|plamo:tag|>input<|plamo:key|>lang<|plamo:val|>en<|plamo:msg|>Hello" +
        "<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>ja<|plamo:msg|>",
    );
    expect(buildPfml3Prompt("Hello", "en", "ja")).not.toContain("<|plamo:bos|>");
  });

  it("removes PLaMo reserved symbols from text and context", () => {
    const prompt = buildPfml3Prompt(
      "Before<|plamo:tag|>After",
      "en",
      "ja",
      "Context<|plamo:msg|>Injected",
    );
    expect(prompt).toContain("<|plamo:msg|>BeforeAfter");
    expect(prompt).toContain("<|plamo:msg|>ContextInjected<|plamo:tag|>input");
  });
});

describe("translatePlamoUncached", () => {
  it("sends the completions request and escapes returned text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion(" <b>訳</b> "));
    vi.stubGlobal("fetch", fetchMock);
    const result = await translatePlamoUncached([{ html: "Hello.", i: 0 }], "en", "ja", config);
    expect(result).toEqual([
      { sentences: [{ source: "Hello.", translation: "&lt;b&gt;訳&lt;/b&gt;" }] },
    ]);
    const request: unknown = fetchMock.mock.calls[0]?.[1];
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:8765/v1/completions");
    expect(request).toMatchObject({ headers: { "Content-Type": "application/json" } });
    expect(isRecord(request) && request.signal instanceof AbortSignal).toBe(true);
    expect(requestBody(fetchMock.mock.calls[0] ?? [])).toMatchObject({
      max_tokens: 64,
      model: "default_model",
      stop: ["<|plamo:tag|>", "<|plamo:bos|>"],
      temperature: 0,
    });
  });

  it("uses preceding original text as context", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion("訳"));
    vi.stubGlobal("fetch", fetchMock);
    await translatePlamoUncached(
      [{ html: "First sentence. Second sentence.", i: 0 }],
      "en",
      "ja",
      config,
    );
    const prompt = requestBody(fetchMock.mock.calls[1] ?? []).prompt;
    expect(typeof prompt === "string" ? prompt : "").toContain(
      "<|plamo:tag|>context<|plamo:msg|>First sentence.",
    );
  });
});

describe("translatePlamoUncached failure and concurrency", () => {
  it("retries a failed sentence once as the whole block", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("sentence failed"))
      .mockResolvedValueOnce(completion("第二文"))
      .mockResolvedValueOnce(completion("全文訳"));
    vi.stubGlobal("fetch", fetchMock);
    const html = "First sentence. Second sentence.";
    const result = await translatePlamoUncached([{ html, i: 0 }], "en", "ja", config);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toEqual([{ sentences: [{ source: html, translation: "全文訳" }] }]);
  });

  it("returns null instead of empty sentences after the whole-block retry fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const result = await translatePlamoUncached(
      [{ html: "Only sentence.", i: 0 }],
      "en",
      "ja",
      config,
    );
    expect(result).toEqual([null]);
  });
});

describe("translatePlamoUncached concurrency", () => {
  it("limits one endpoint to eight concurrent requests", async () => {
    const resolvers: Array<() => void> = [];
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolvers.push(() => {
            resolve(completion("訳"));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const promise = translatePlamoUncached(
      Array.from({ length: 9 }, (_, i) => ({ html: `Sentence ${i}.`, i })),
      "en",
      "ja",
      config,
    );
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(8);
    });
    resolvers[0]?.();
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(9);
    });
    resolvers.slice(1).forEach((resolve) => {
      resolve();
    });
    await promise;
  });

  it("uses the shared 120 second request timeout constant", () => {
    expect(LOCAL_REQUEST_TIMEOUT_MS).toBe(120_000);
  });
});
