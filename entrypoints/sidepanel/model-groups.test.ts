import { describe, expect, it } from "vitest";
import {
  groupModelsByVendor,
  modelCatalogLabel,
  splitModelCatalog,
  type ModelCatalogEntry,
  type ModelCatalogGroup,
} from "./model-groups";

describe("groupModelsByVendor", () => {
  it("groups models by vendor and sorts vendors and models stably by name", () => {
    expect(groupModelsByVendor(groupedModels())).toEqual(expectedGroupedModels());
  });

  it("keeps models with unknown vendor formats in a final fallback group", () => {
    const groups = groupModelsByVendor(modelsWithUnknownVendor());

    expect(groups).toEqual([
      {
        models: [{ id: "openrouter/openai/gpt-4.1", isLatestAlias: false, name: "GPT-4.1" }],
        vendor: "openai",
      },
      {
        models: [
          { id: "custom/model", isLatestAlias: false, name: "Custom" },
          { id: "openrouter/standalone-model", isLatestAlias: false, name: "Standalone" },
        ],
        vendor: null,
      },
    ]);
  });

  it("merges latest aliases with fixed models without changing their IDs", () => {
    const alias = { id: "openrouter/~anthropic/claude-sonnet-latest", name: "Claude Sonnet" };
    const fixed = { id: "openrouter/anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" };

    expect(groupModelsByVendor([alias, fixed])).toEqual([
      {
        models: [
          { ...alias, isLatestAlias: true },
          { ...fixed, isLatestAlias: false },
        ],
        vendor: "anthropic",
      },
    ]);
    expect(alias.id).toBe("openrouter/~anthropic/claude-sonnet-latest");
  });
});

describe("splitModelCatalog", () => {
  it("separates latest aliases from fixed models without changing IDs", () => {
    const [alias, fixed] = anthropicModels();

    expect(splitModelCatalog([alias, fixed])).toEqual({ fixed: [fixed], latest: [alias] });
    expect(alias.id).toBe("openrouter/~anthropic/claude-sonnet-latest");
    expect(fixed.id).toBe("openrouter/anthropic/claude-sonnet-4.5");
  });
});

describe("modelCatalogLabel", () => {
  it("removes the group vendor from model labels without exposing the internal model ID", () => {
    const [alias, fixed] = anthropicModels();

    expect(modelCatalogLabel(alias)).toBe("Claude Sonnet");
    expect(modelCatalogLabel(fixed)).toBe("Claude Sonnet 4.5");
    expect(alias.id).toBe("openrouter/~anthropic/claude-sonnet-latest");
  });
});

describe("modelCatalogLabel vendor prefixes", () => {
  it("removes vendor prefixes written with spaces and punctuation", () => {
    expect(
      modelCatalogLabel({
        id: "openrouter/~anthropic/claude-opus-latest",
        name: "Anthropic: Claude Opus Latest",
      }),
    ).toBe("Claude Opus Latest");
    expect(
      modelCatalogLabel({
        id: "openrouter/~google/gemini-flash-latest",
        name: "Google Gemini Flash Latest",
      }),
    ).toBe("Gemini Flash Latest");
    expect(
      modelCatalogLabel({
        id: "openrouter/~moonshotai/kimi-latest",
        name: "MoonshotAI Kimi Latest",
      }),
    ).toBe("Kimi Latest");
    expect(
      modelCatalogLabel({
        id: "openrouter/~z-ai/glm-latest",
        name: "Z.ai: GLM Latest",
      }),
    ).toBe("GLM Latest");
    expect(
      modelCatalogLabel({
        id: "openrouter/~x-ai/grok-latest",
        name: "xAI: Grok Latest",
      }),
    ).toBe("Grok Latest");
    expect(
      modelCatalogLabel({
        id: "openrouter/~openai/gpt-latest",
        name: "OpenAI GPT Latest",
      }),
    ).toBe("GPT Latest");
  });
});

describe("modelCatalogLabel similar names", () => {
  it("does not remove a vendor-name prefix from another word or a hyphenated name", () => {
    expect(
      modelCatalogLabel({
        id: "openrouter/meta-llama/metafile-v1",
        name: "Metafile V1",
      }),
    ).toBe("Metafile V1");
    expect(
      modelCatalogLabel({
        id: "openrouter/openai/openai-compatible",
        name: "OpenAI-compatible",
      }),
    ).toBe("OpenAI-compatible");
  });
});

function anthropicModels(): readonly [ModelCatalogEntry, ModelCatalogEntry] {
  return [
    { id: "openrouter/~anthropic/claude-sonnet-latest", name: "Claude Sonnet" },
    { id: "openrouter/anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
  ];
}

function expectedGroupedModels(): readonly ModelCatalogGroup[] {
  return [
    {
      models: [
        { id: "openrouter/anthropic/claude-haiku", isLatestAlias: false, name: "Claude Haiku" },
        { id: "openrouter/anthropic/claude-sonnet", isLatestAlias: false, name: "Claude Sonnet" },
      ],
      vendor: "anthropic",
    },
    {
      models: [
        { id: "openrouter/openai/gpt-4.1", isLatestAlias: false, name: "GPT-4.1" },
        { id: "openrouter/openai/gpt-4.1-mini", isLatestAlias: false, name: "GPT-4.1 mini" },
      ],
      vendor: "openai",
    },
    {
      models: [{ id: "openrouter/z-ai/glm-4.5", isLatestAlias: false, name: "GLM 4.5" }],
      vendor: "z-ai",
    },
  ];
}

function groupedModels(): readonly ModelCatalogEntry[] {
  return [
    { id: "openrouter/z-ai/glm-4.5", name: "GLM 4.5" },
    { id: "openrouter/openai/gpt-4.1", name: "GPT-4.1" },
    { id: "openrouter/anthropic/claude-sonnet", name: "Claude Sonnet" },
    { id: "openrouter/openai/gpt-4.1-mini", name: "GPT-4.1 mini" },
    { id: "openrouter/anthropic/claude-haiku", name: "Claude Haiku" },
  ];
}

function modelsWithUnknownVendor(): readonly ModelCatalogEntry[] {
  return [
    { id: "openrouter/standalone-model", name: "Standalone" },
    { id: "custom/model", name: "Custom" },
    { id: "openrouter/openai/gpt-4.1", name: "GPT-4.1" },
  ];
}
