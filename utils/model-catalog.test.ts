import { describe, expect, it, vi } from "vitest";
import { discoverOpenRouterModels } from "./model-catalog";

interface ModelCatalogRequestInit {
  readonly headers?: Readonly<Record<string, string>>;
  readonly method?: string;
}

type ModelCatalogFetch = (
  input: string,
  init?: ModelCatalogRequestInit,
) => Promise<Pick<Response, "json" | "ok">>;

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
    const httpFailure = vi.fn<ModelCatalogFetch>().mockResolvedValue(response({ error: "secret" }, false));
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
