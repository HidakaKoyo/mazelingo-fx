/* oxlint-disable max-lines, max-lines-per-function */
import { describe, expect, it, vi } from "vitest";
import {
  detectApiKeyProviderHint,
  discoverModelCatalog,
  discoverOpenRouterModels,
  isKnownOpenAIChatModelId,
  type ModelCatalogFetch,
} from "./model-catalog";
import { resolveProvider } from "./llm-providers";

function response(payload: unknown, ok = true): Pick<Response, "json" | "ok"> {
  return {
    json: (): Promise<unknown> => Promise.resolve(payload),
    ok,
  };
}

function rejectedJson(): Pick<Response, "json" | "ok"> {
  return {
    json: (): Promise<unknown> => {
      throw new Error("secret");
    },
    ok: true,
  };
}

function modelData(): unknown {
  return {
    data: [
      {
        architecture: { output_modalities: ["text"] },
        id: "openai/gpt-4.1-mini",
        name: "GPT-4.1 mini",
        supported_parameters: ["response_format", "structured_outputs"],
      },
      {
        architecture: { output_modalities: ["image"] },
        id: "image/model",
        name: "Image model",
        supported_parameters: ["response_format", "structured_outputs"],
      },
      {
        id: "deepseek/deepseek-chat",
        name: "  ",
        supported_parameters: ["response_format", "structured_outputs"],
      },
      {
        id: "openai/gpt-4.1-mini",
        name: "Duplicate",
        supported_parameters: ["response_format", "structured_outputs"],
      },
      {
        id: "missing/structured-output",
        name: "Missing structured output",
        supported_parameters: ["response_format"],
      },
      {
        id: "missing/response-format",
        name: "Missing response format",
        supported_parameters: ["structured_outputs"],
      },
      {
        id: " ",
        name: "No identifier",
        supported_parameters: ["response_format", "structured_outputs"],
      },
    ],
  };
}

function expectFailed(fetchImpl: ModelCatalogFetch): Promise<void> {
  return expect(discoverOpenRouterModels("test-openrouter-key", fetchImpl)).resolves.toEqual({
    models: [],
    status: "failed",
  });
}

function testNotConfigured(): void {
  it("does not fetch when an OpenRouter key is not configured", async () => {
    const fetchImpl = vi.fn<ModelCatalogFetch>();

    await expect(discoverOpenRouterModels("   ", fetchImpl)).resolves.toEqual({
      models: [],
      status: "not-configured",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
}

function testRequest(): void {
  it("uses the key only as a Bearer header for the user-scoped models endpoint", async () => {
    const fetchImpl = vi.fn<ModelCatalogFetch>().mockResolvedValue(response({ data: [] }));

    await discoverOpenRouterModels("test-openrouter-key", fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/models/user?output_modalities=text&limit=1000",
      {
        headers: { Authorization: "Bearer test-openrouter-key" },
        method: "GET",
      },
    );
  });
}

function testNormalization(): void {
  it("keeps supported text models in response order and normalizes their identifiers", async () => {
    const fetchImpl = vi.fn<ModelCatalogFetch>().mockResolvedValue(response(modelData()));

    await expect(discoverOpenRouterModels("test-openrouter-key", fetchImpl)).resolves.toEqual({
      models: [
        { id: "openrouter/openai/gpt-4.1-mini", name: "GPT-4.1 mini" },
        { id: "openrouter/deepseek/deepseek-chat", name: "deepseek/deepseek-chat" },
      ],
      status: "ready",
    });
  });
}

function testFailures(): void {
  it("returns a safe failure without provider details for HTTP, parse, and shape failures", async () => {
    const httpFailure = vi
      .fn<ModelCatalogFetch>()
      .mockResolvedValue(response({ error: "secret" }, false));
    const invalidJson = vi.fn<ModelCatalogFetch>().mockResolvedValue(rejectedJson());
    const invalidShape = vi.fn<ModelCatalogFetch>().mockResolvedValue(response({ data: {} }));

    await expectFailed(httpFailure);
    await expectFailed(invalidJson);
    await expectFailed(invalidShape);
  });
}

describe("discoverOpenRouterModels", () => {
  testNotConfigured();
  testRequest();
  testNormalization();
  testFailures();
});

describe("provider key hints", () => {
  it("only gives a local format hint and keeps unknown formats unknown", () => {
    expect(detectApiKeyProviderHint("sk-or-v1-test-key")).toBe("openrouter");
    expect(detectApiKeyProviderHint("sk-ant-test-key")).toBe("anthropic");
    expect(detectApiKeyProviderHint("AIza-test-key")).toBe("google");
    expect(detectApiKeyProviderHint("sk-test-key")).toBe("openai");
    expect(detectApiKeyProviderHint("provider-specific-key")).toBe("unknown");
  });
});

describe("isKnownOpenAIChatModelId", () => {
  it("accepts known chat families and dated snapshots", () => {
    expect(isKnownOpenAIChatModelId("gpt-4.1-mini")).toBe(true);
    expect(isKnownOpenAIChatModelId("gpt-4.1-mini-2025-04-14")).toBe(true);
    expect(isKnownOpenAIChatModelId("o3-mini")).toBe(true);
  });

  it("leaves non-chat and unknown model families as Custom", () => {
    expect(isKnownOpenAIChatModelId("gpt-image-1")).toBe(false);
    expect(isKnownOpenAIChatModelId("gpt-realtime")).toBe(false);
    expect(isKnownOpenAIChatModelId("gpt-search-preview")).toBe(false);
    expect(isKnownOpenAIChatModelId("unknown-model")).toBe(false);
  });
});

describe("catalog model adapter compatibility", () => {
  it("keeps listed OpenAI IDs on the existing gpt API-key adapter", () => {
    ["gpt-4.1-mini", "gpt-4.1-mini-2025-04-14", "o3-mini"].forEach((modelId) => {
      const resolved = resolveProvider(modelId);
      expect(resolved).not.toBeNull();
      expect(resolved?.entry.apiKeyKey ?? resolved?.prefix).toBe("gpt");
    });
  });
});

describe("discoverModelCatalog", () => {
  it("fetches only the requested OpenAI provider and filters to known chat models", async () => {
    const fetchImpl = vi.fn<ModelCatalogFetch>().mockResolvedValue(
      response({
        data: [
          { id: "gpt-4.1-mini" },
          { id: "gpt-4.1-mini" },
          { id: "gpt-4.1-mini-2025-04-14" },
          { id: "gpt-image-1" },
          { id: "o3-mini" },
          { id: "unknown-model" },
        ],
      }),
    );

    await expect(
      discoverModelCatalog(
        { claude: "test-anthropic-key", gpt: "test-openai-key" },
        ["gpt"],
        fetchImpl,
      ),
    ).resolves.toEqual({
      models: [
        { id: "gpt-4.1-mini", name: "gpt-4.1-mini" },
        { id: "gpt-4.1-mini-2025-04-14", name: "gpt-4.1-mini-2025-04-14" },
        { id: "o3-mini", name: "o3-mini" },
      ],
      providers: [
        {
          models: [
            { id: "gpt-4.1-mini", name: "gpt-4.1-mini" },
            { id: "gpt-4.1-mini-2025-04-14", name: "gpt-4.1-mini-2025-04-14" },
            { id: "o3-mini", name: "o3-mini" },
          ],
          provider: "gpt",
          status: "ready",
        },
      ],
      status: "ready",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith("https://api.openai.com/v1/models", {
      headers: { Authorization: "Bearer test-openai-key" },
      method: "GET",
    });
  });

  it("follows Anthropic pagination and returns only Claude model display data", async () => {
    const fetchImpl = vi
      .fn<ModelCatalogFetch>()
      .mockResolvedValueOnce(
        response({
          data: [
            { display_name: "Claude Sonnet", id: "claude-sonnet-4-20250514" },
            { display_name: "Not Claude", id: "other-model" },
          ],
          has_more: true,
          last_id: "claude-sonnet-4-20250514",
        }),
      )
      .mockResolvedValueOnce(
        response({
          data: [{ display_name: "Claude Haiku", id: "claude-3-5-haiku-20241022" }],
          has_more: false,
          last_id: "claude-3-5-haiku-20241022",
        }),
      );

    await expect(
      discoverModelCatalog({ claude: "test-anthropic-key" }, ["claude"], fetchImpl),
    ).resolves.toMatchObject({
      models: [
        { id: "claude-sonnet-4-20250514", name: "Claude Sonnet" },
        { id: "claude-3-5-haiku-20241022", name: "Claude Haiku" },
      ],
      status: "ready",
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(1, "https://api.anthropic.com/v1/models?limit=1000", {
      headers: {
        "anthropic-version": "2023-06-01",
        "x-api-key": "test-anthropic-key",
      },
      method: "GET",
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://api.anthropic.com/v1/models?limit=1000&after_id=claude-sonnet-4-20250514",
      {
        headers: {
          "anthropic-version": "2023-06-01",
          "x-api-key": "test-anthropic-key",
        },
        method: "GET",
      },
    );
  });

  it("follows Google pagination and filters to generateContent Gemini models", async () => {
    const fetchImpl = vi
      .fn<ModelCatalogFetch>()
      .mockResolvedValueOnce(
        response({
          models: [
            {
              baseModelId: "gemini-2.5-flash",
              displayName: "Gemini 2.5 Flash",
              supportedGenerationMethods: ["generateContent"],
            },
            {
              baseModelId: "gemini-embedding-001",
              displayName: "Gemini Embedding",
              supportedGenerationMethods: ["embedContent"],
            },
          ],
          nextPageToken: "next-page",
        }),
      )
      .mockResolvedValueOnce(
        response({
          models: [
            {
              baseModelId: "gemini-2.0-flash",
              supportedGenerationMethods: ["generateContent"],
            },
          ],
        }),
      );

    await expect(
      discoverModelCatalog({ gemini: "test-google-key" }, ["gemini"], fetchImpl),
    ).resolves.toMatchObject({
      models: [
        { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
        { id: "gemini-2.0-flash", name: "gemini-2.0-flash" },
      ],
      status: "ready",
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
      {
        headers: { "x-goog-api-key": "test-google-key" },
        method: "GET",
      },
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&pageToken=next-page",
      {
        headers: { "x-goog-api-key": "test-google-key" },
        method: "GET",
      },
    );
  });

  it("does not fetch an unconfigured provider or fall back to another endpoint", async () => {
    const fetchImpl = vi.fn<ModelCatalogFetch>();

    await expect(
      discoverModelCatalog({ claude: "test-anthropic-key", gpt: "" }, ["gpt"], fetchImpl),
    ).resolves.toEqual({
      models: [],
      providers: [{ models: [], provider: "gpt", status: "not-configured" }],
      status: "not-configured",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not fetch when an explicit provider scope is empty", async () => {
    const fetchImpl = vi.fn<ModelCatalogFetch>();

    await expect(discoverModelCatalog({ gpt: "test-openai-key" }, [], fetchImpl)).resolves.toEqual({
      models: [],
      providers: [],
      status: "not-configured",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns a provider-scoped failure without leaking response details", async () => {
    const fetchImpl = vi
      .fn<ModelCatalogFetch>()
      .mockResolvedValue(response({ error: "secret" }, false));

    await expect(
      discoverModelCatalog({ gpt: "test-openai-key" }, ["gpt"], fetchImpl),
    ).resolves.toEqual({
      models: [],
      providers: [{ models: [], provider: "gpt", status: "failed" }],
      status: "failed",
    });
  });
});
