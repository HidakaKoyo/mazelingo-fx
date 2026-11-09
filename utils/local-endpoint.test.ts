import { afterEach, describe, expect, it, vi } from "vitest";
import { callLLMChain, TRANSLATION_SCHEMA } from "./llm";
import { buildLLMRequest } from "./llm-providers";
import {
  buildLocalEndpointUrl,
  DEFAULT_LOCAL_ENDPOINT,
  LOCAL_REQUEST_TIMEOUT_MS,
  mergeLocalEndpoint,
  resolveLocalProvider,
} from "./local-endpoint";
import type { ChatMessage } from "./llm";

const MESSAGES: ChatMessage[] = [{ content: "Hello", role: "user" }];
const ENDPOINT = { apiKey: "", baseUrl: "http://127.0.0.1:8765/v1/" } as const;
const UNSET: unknown = undefined;

interface MockResponse {
  readonly json: () => Promise<unknown>;
  readonly ok: boolean;
}

function response(content: string): MockResponse {
  return {
    json: (): Promise<unknown> => Promise.resolve({ choices: [{ message: { content } }] }),
    ok: true,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function testRequestShape(): void {
  it("builds /chat/completions with the unprefixed model and no empty auth header", () => {
    const provider = resolveLocalProvider("custom/default_model", ENDPOINT);
    if (provider === null) throw new Error("expected a local provider");
    const request = buildLLMRequest(
      provider,
      "custom/default_model",
      MESSAGES,
      "",
      TRANSLATION_SCHEMA,
    );
    expect(request.url).toBe("http://127.0.0.1:8765/v1/chat/completions");
    expect(buildLocalEndpointUrl(ENDPOINT.baseUrl, "/completions")).toBe(
      "http://127.0.0.1:8765/v1/completions",
    );
    expect(request.options.headers.Authorization).toBeUndefined();
    expect(JSON.parse(request.options.body)).toMatchObject({ model: "default_model" });
  });

  it.each(["custom/default_model", "local/default_model"])(
    "resolves %s to the custom server",
    (model) => {
      expect(resolveLocalProvider(model, ENDPOINT)?.entry.baseUrl).toBe(
        "http://127.0.0.1:8765/v1/chat/completions",
      );
    },
  );
}

function testOptionalApiKey(): void {
  it("calls the local endpoint when the API key is empty", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response('{"ok":true}'));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      callLLMChain(["custom/test-model"], MESSAGES, {}, undefined, ENDPOINT),
    ).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("adds a bearer header when the optional API key is set", async () => {
    let authorization: string | undefined;
    const fetchMock = vi.fn(
      (
        _url: string,
        options: Readonly<{ headers: Readonly<Record<string, string>> }>,
      ): Promise<MockResponse> => {
        authorization = options.headers.Authorization;
        return Promise.resolve(response('{"ok":true}'));
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    await callLLMChain(["custom/test-model"], MESSAGES, {}, undefined, {
      ...ENDPOINT,
      apiKey: "local-secret",
    });
    expect(authorization).toBe("Bearer local-secret");
  });
}

function testTimeoutFallback(): void {
  it("aborts a stalled local request and falls back to the next model", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        (_url: string, options: Readonly<{ signal?: Readonly<AbortSignal> }>) =>
          new Promise<MockResponse>((_resolve, reject) => {
            options.signal?.addEventListener("abort", () => {
              reject(new Error("aborted"));
            });
          }),
      )
      .mockResolvedValueOnce(response('{"provider":"openai"}'));
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = callLLMChain(
      ["custom/default_model", "gpt-4.1-mini"],
      MESSAGES,
      { gpt: "openai-key" },
      undefined,
      ENDPOINT,
    );
    await vi.advanceTimersByTimeAsync(LOCAL_REQUEST_TIMEOUT_MS);

    await expect(resultPromise).resolves.toEqual({ provider: "openai" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
}

function testEmptyDefault(): void {
  it("defaults to an empty base URL", () => {
    expect(mergeLocalEndpoint(UNSET)).toEqual({
      ...DEFAULT_LOCAL_ENDPOINT,
      baseUrl: "",
    });
  });

  it("does not call the local model when the default base URL is empty", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response('{"provider":"openai"}'));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      callLLMChain(
        ["custom/default_model", "gpt-4.1-mini"],
        MESSAGES,
        { gpt: "openai-key" },
        UNSET,
        mergeLocalEndpoint(UNSET),
      ),
    ).resolves.toEqual({ provider: "openai" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.any(Object),
    );
  });
}

describe("local endpoint", () => {
  testEmptyDefault();
  testRequestShape();
  testOptionalApiKey();
  testTimeoutFallback();
});
