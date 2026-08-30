import { describe, expect, it, vi, afterEach } from "vitest";
import { callLLM, callLLMChain, LLM_REGISTRY, TRANSLATION_SCHEMA } from "./llm";
import { buildLLMRequest, resolveProvider } from "./llm-providers";
import type { ResolvedProvider } from "./llm-providers";
import type { ChatMessage } from "./llm";

const MSGS: ChatMessage[] = [
  { role: "system", content: "You translate." },
  { role: "user", content: "Hello" },
];

function provider(model: string): ResolvedProvider {
  const resolved = resolveProvider(model);
  if (!resolved) throw new Error(`no provider for ${model}`);
  return resolved;
}

type MockResponse = {
  ok: boolean;
  status?: number;
  json: () => unknown;
  text: () => string;
};

function openAIResponse(content: string): MockResponse {
  return {
    ok: true,
    json: (): unknown => ({ choices: [{ message: { content } }] }),
    text: (): string => "",
  };
}

function anthropicResponse(content: string): MockResponse {
  return {
    ok: true,
    json: (): unknown => ({ content: [{ type: "text", text: content }] }),
    text: (): string => "",
  };
}

function errorResponse(status: number, message: string): MockResponse {
  return {
    ok: false,
    status,
    json: (): unknown => ({ error: { message } }),
    text: (): string => JSON.stringify({ error: { message } }),
  };
}

function geminiErrorResponse(): MockResponse {
  return {
    ok: true,
    json: (): unknown => ({ error: { message: "quota exhausted" } }),
    text: (): string => "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBodyObject(body: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(body);
  if (!isRecord(parsed)) {
    throw new Error("expected a JSON object body");
  }
  return parsed;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildLLMRequest", () => {
  testOpenAIRequest();
  testOpenRouterRequest();
  testAnthropicRequest();
  testGoogleRequest();
  testUnknownProvider();
});

function testOpenAIRequest(): void {
  it("builds an OpenAI-compatible request with JSON schema response_format", () => {
    const req = buildLLMRequest(
      provider("gpt-4.1-mini"),
      "gpt-4.1-mini",
      MSGS,
      "sk-test",
      TRANSLATION_SCHEMA,
    );
    expect(req.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(req.options.method).toBe("POST");
    expect(req.options.headers.Authorization).toBe("Bearer sk-test");
    const body = parseBodyObject(req.options.body);
    expect(body.model).toBe("gpt-4.1-mini");
    expect(body.messages).toEqual(MSGS);
    const responseFormat = toRecord(body.response_format);
    expect(responseFormat?.type).toBe("json_schema");
    const jsonSchema = toRecord(responseFormat?.json_schema);
    expect(jsonSchema?.schema).toEqual(TRANSLATION_SCHEMA);
    expect(body.provider).toBeUndefined();
  });
}

function testOpenRouterRequest(): void {
  it("builds the openrouter/ prefix and adds OpenRouter headers", () => {
    const req = buildLLMRequest(
      provider("openrouter/openai/gpt-4.1-mini"),
      "openrouter/openai/gpt-4.1-mini",
      MSGS,
      "or-key",
      TRANSLATION_SCHEMA,
    );
    const body = parseBodyObject(req.options.body);
    expect(body.model).toBe("openai/gpt-4.1-mini");
    expect(body.provider).toEqual({ require_parameters: true });
    expect(req.options.headers["HTTP-Referer"]).toContain("mazelingo");
    expect(req.options.headers["X-OpenRouter-Title"]).toBe("Mazelingo");
  });
}

function testAnthropicRequest(): void {
  it('builds an Anthropic request with role mapping and "{": prefill', () => {
    const req = buildLLMRequest(
      provider("claude-haiku-4-5"),
      "claude-haiku-4-5",
      MSGS,
      "an-key",
      TRANSLATION_SCHEMA,
    );
    expect(req.url).toBe("https://api.anthropic.com/v1/messages");
    expect(req.options.headers["x-api-key"]).toBe("an-key");
    const body = parseBodyObject(req.options.body);
    expect(body.system).toContain("Respond with ONLY valid JSON");
    // system removed from messages, prefill assistant "{" appended
    expect(body.messages).toEqual([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "{" },
    ]);
  });
}

function testGoogleRequest(): void {
  it("builds a Google request mapping assistant->model and adding systemInstruction", () => {
    const req = buildLLMRequest(
      provider("gemini-2.5-flash"),
      "gemini-2.5-flash",
      MSGS,
      "g-key",
      TRANSLATION_SCHEMA,
    );
    expect(req.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    );
    expect(req.options.headers["x-goog-api-key"]).toBe("g-key");
    const body = parseBodyObject(req.options.body);
    const systemInstruction = toRecord(body.systemInstruction);
    const parts = systemInstruction ? systemInstruction.parts : null;
    const firstPart = Array.isArray(parts) ? toRecord(parts[0]) : null;
    expect(firstPart?.text).toBe("You translate.");
    expect(body.contents).toEqual([{ role: "user", parts: [{ text: "Hello" }] }]);
  });
}

function testUnknownProvider(): void {
  it("resolves to null for an unknown model name", () => {
    expect(resolveProvider("unknown-model")).toBeNull();
  });
}

describe("callLLM (mocked fetch)", () => {
  testOpenAIResponseParsing();
  testMarkdownCodeBlockStripped();
  testNonOkErrorSurfacesApiMessage();
  testGeminiErrorPayload();
});

function testOpenAIResponseParsing(): void {
  it("parses an OpenAI response via the content field", async () => {
    const mockResponse = openAIResponse('{"source":"2 + 2","translation":"4"}');
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const result = await callLLM(provider("gpt-4.1-mini"), "gpt-4.1-mini", MSGS, "sk-test");
    expect(result).toEqual({ source: "2 + 2", translation: "4" });
  });
}

function testMarkdownCodeBlockStripped(): void {
  it("strips a markdown code block wrapper before parsing", async () => {
    const mockResponse = openAIResponse('```json\n{"a":1}\n```');
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));
    const result = await callLLM(provider("gpt-4.1-mini"), "gpt-4.1-mini", MSGS, "sk-test");
    expect(result).toEqual({ a: 1 });
  });
}

function testNonOkErrorSurfacesApiMessage(): void {
  it("throws a descriptive error on a non-ok response, surfacing the API message", async () => {
    const mockResponse = errorResponse(401, "Invalid API key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));
    await expect(callLLM(provider("gpt-4.1-mini"), "gpt-4.1-mini", MSGS, "bad")).rejects.toThrow(
      /LLM request failed \(401\): Invalid API key/u,
    );
  });

  it("redacts the API key if a provider echoes it in an error", async () => {
    const mockResponse = errorResponse(401, "Rejected credential secret-test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const request = callLLM(provider("gpt-4.1-mini"), "gpt-4.1-mini", MSGS, "secret-test-key");
    await expect(request).rejects.toThrow(/Rejected credential \[REDACTED\]/u);
    await expect(request).rejects.not.toThrow(/secret-test-key/u);
  });
}

function testGeminiErrorPayload(): void {
  it("throws on a Gemini error payload", async () => {
    const mockResponse = geminiErrorResponse();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));
    await expect(
      callLLM(provider("gemini-2.5-flash"), "gemini-2.5-flash", MSGS, "g-key"),
    ).rejects.toThrow(/Gemini API error: quota exhausted/u);
  });
}

describe("callLLMChain", () => {
  testChainSkipsUnkeyedModels();
  testChainFallback();
  testChainAllFail();
  testChainNoKeys();
});

function testChainSkipsUnkeyedModels(): void {
  it("skips models without an API key and uses the first keyed model", async () => {
    const mockResponse = openAIResponse('{"ok":true}');
    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchMock);

    const result = await callLLMChain(["gpt-4.1-mini", "claude-haiku-4-5"], MSGS, {
      gpt: "sk-key",
    });
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0];
    expect(String(firstCall?.[0])).toContain("api.openai.com");
  });
}

function testChainFallback(): void {
  it("falls through to a second model when the first throws", async () => {
    const fail = errorResponse(500, "server error");
    const succeed = anthropicResponse('"ok":"claude"}');
    const fetchMock = vi.fn().mockResolvedValueOnce(fail).mockResolvedValueOnce(succeed);
    vi.stubGlobal("fetch", fetchMock);

    const result = await callLLMChain(["gpt-4.1-mini", "claude-haiku-4-5"], MSGS, {
      gpt: "sk",
      claude: "an",
    });
    expect(result).toEqual({ ok: "claude" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
}

function testChainAllFail(): void {
  it("throws an aggregated error when all keyed models fail", async () => {
    const fail = errorResponse(500, "boom");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fail));
    await expect(callLLMChain(["gpt-4.1-mini"], MSGS, { gpt: "sk" })).rejects.toThrow(
      /All models failed/u,
    );
  });
}

function testChainNoKeys(): void {
  it("throws when no API key is available for any model", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(callLLMChain(["gpt-4.1-mini"], MSGS, {})).rejects.toThrow(
      /No API keys available/u,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
}

describe("registry", () => {
  it("exposes providers and the translation schema", () => {
    expect(LLM_REGISTRY.claude).toBeDefined();
    expect(TRANSLATION_SCHEMA.required).toContain("blocks");
  });
});
