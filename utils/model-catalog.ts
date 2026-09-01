/* oxlint-disable max-lines, no-await-in-loop */

/**
 * Safe, key-scoped model discovery for providers that expose it.
 *
 * This module intentionally returns only normalized display data. It never
 * returns provider response bodies, error text, or the credential supplied to
 * it. Key-format detection is a local input hint only; it does not authenticate
 * a key or select an endpoint.
 */

export const CATALOG_PROVIDER_IDS = ["openrouter", "gpt", "claude", "gemini"] as const;
export type CatalogProviderId = (typeof CATALOG_PROVIDER_IDS)[number];

export type CatalogStatus = "not-configured" | "failed" | "ready";

export type ApiKeyProviderHint = "openrouter" | "openai" | "anthropic" | "google" | "unknown";

export interface DiscoveredModel {
  readonly id: string;
  readonly name: string;
}

export interface CatalogProviderResult {
  readonly provider: CatalogProviderId;
  readonly status: CatalogStatus;
  readonly models: readonly DiscoveredModel[];
}

export interface ModelCatalogDiscoveryResult {
  readonly status: CatalogStatus;
  readonly models: readonly DiscoveredModel[];
  readonly providers: readonly CatalogProviderResult[];
}

interface CatalogProviderDefinition {
  readonly id: CatalogProviderId;
  readonly apiKeyKey: CatalogProviderId;
  readonly displayName: string;
}

export const CATALOG_PROVIDER_DEFINITIONS: readonly CatalogProviderDefinition[] = [
  { apiKeyKey: "openrouter", displayName: "OpenRouter", id: "openrouter" },
  { apiKeyKey: "gpt", displayName: "OpenAI", id: "gpt" },
  { apiKeyKey: "claude", displayName: "Anthropic", id: "claude" },
  { apiKeyKey: "gemini", displayName: "Google Gemini", id: "gemini" },
];

const OPENROUTER_MODELS_URL =
  "https://openrouter.ai/api/v1/models/user?output_modalities=text&limit=1000";
const OPENAI_MODELS_URL = "https://api.openai.com/v1/models";
const ANTHROPIC_MODELS_URL = "https://api.anthropic.com/v1/models";
const GOOGLE_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_MODEL_CATALOG_PAGES = 100;

export interface ModelCatalogRequestInit {
  readonly headers?: Readonly<Record<string, string>>;
  readonly method?: string;
}

export type ModelCatalogFetch = (
  input: string,
  init?: ModelCatalogRequestInit,
) => Promise<Pick<Response, "json" | "ok">>;

export type OpenRouterModelDiscoveryResult = Omit<CatalogProviderResult, "provider">;

/**
 * Returns a local-only hint about a pasted key. The result must never be used
 * to choose a network destination or to persist the key.
 */
export function detectApiKeyProviderHint(value: string): ApiKeyProviderHint {
  const key = value.trim();
  if (key.startsWith("sk-or-v1-")) return "openrouter";
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (/^AIza[A-Za-z0-9_-]+$/u.test(key)) return "google";
  if (key.startsWith("sk-")) return "openai";
  return "unknown";
}

export function isCatalogProviderId(value: unknown): value is CatalogProviderId {
  return typeof value === "string" && CATALOG_PROVIDER_IDS.some((provider) => provider === value);
}

export function catalogProviderDisplayName(provider: CatalogProviderId): string {
  return (
    CATALOG_PROVIDER_DEFINITIONS.find((definition) => definition.id === provider)?.displayName ??
    provider
  );
}

/**
 * OpenAI's models list does not expose the Chat Completions or JSON-schema
 * capability needed by this extension. Keep the automatic list conservative:
 * only known text chat families are admitted, and unknown IDs remain Custom.
 */
export function isKnownOpenAIChatModelId(modelId: string): boolean {
  const normalized = modelId.trim();
  if (normalized === "") return false;
  const withoutSnapshot = normalized.replace(/-(?:\d{4}|\d{4}-\d{2}-\d{2})$/u, "");
  return (
    OPENAI_CHAT_MODEL_PATTERN.test(normalized) || OPENAI_CHAT_MODEL_PATTERN.test(withoutSnapshot)
  );
}

const OPENAI_CHAT_MODEL_PATTERN =
  /^(?:gpt-(?:3\.5-turbo|4|4-turbo|4o|4o-mini|4\.1|4\.1-mini|4\.1-nano|4\.5-preview|5(?:\.\d+)?(?:-(?:mini|nano|pro))?)|o(?:1(?:-(?:mini|pro|preview))?|3(?:-(?:mini|pro))?|4(?:-mini)?))$/u;

export async function discoverModelCatalog(
  apiKeys: Readonly<Record<string, string>>,
  requestedProviders?: readonly CatalogProviderId[],
  fetchImpl: ModelCatalogFetch = fetch,
): Promise<ModelCatalogDiscoveryResult> {
  const providers = selectedProviderDefinitions(requestedProviders);
  const results = await Promise.all(
    providers.map((definition) =>
      discoverProvider(definition, apiKeys[definition.apiKeyKey], fetchImpl),
    ),
  );
  const models = results.flatMap((result) => result.models);
  return {
    models,
    providers: results,
    status: overallStatus(results),
  };
}

/**
 * Backward-compatible OpenRouter-only entry point used by existing tests and
 * callers. The unified path is discoverModelCatalog().
 */
export async function discoverOpenRouterModels(
  apiKey: string | undefined,
  fetchImpl: ModelCatalogFetch = fetch,
): Promise<OpenRouterModelDiscoveryResult> {
  const configuredKey = normalizeApiKey(apiKey);
  if (configuredKey === null) return emptyDiscovery("not-configured");

  try {
    const response = await fetchImpl(OPENROUTER_MODELS_URL, {
      headers: { Authorization: `Bearer ${configuredKey}` },
      method: "GET",
    });
    if (!response.ok) return emptyDiscovery("failed");

    const payload: unknown = await response.json();
    const models = normalizeOpenRouterModels(payload);
    return models === null ? emptyDiscovery("failed") : { models, status: "ready" };
  } catch {
    return emptyDiscovery("failed");
  }
}

async function discoverProvider(
  definition: CatalogProviderDefinition,
  apiKey: string | undefined,
  fetchImpl: ModelCatalogFetch,
): Promise<CatalogProviderResult> {
  const configuredKey = normalizeApiKey(apiKey);
  if (configuredKey === null) {
    return { models: [], provider: definition.id, status: "not-configured" };
  }

  try {
    const result = await discoverConfiguredProvider(definition.id, configuredKey, fetchImpl);
    return { models: result, provider: definition.id, status: "ready" };
  } catch {
    return { models: [], provider: definition.id, status: "failed" };
  }
}

async function discoverConfiguredProvider(
  provider: CatalogProviderId,
  apiKey: string,
  fetchImpl: ModelCatalogFetch,
): Promise<readonly DiscoveredModel[]> {
  switch (provider) {
    case "openrouter": {
      const result = await discoverOpenRouterModels(apiKey, fetchImpl);
      if (result.status !== "ready") throw new Error("catalog unavailable");
      return result.models;
    }
    case "gpt":
      return discoverOpenAIModels(apiKey, fetchImpl);
    case "claude":
      return discoverAnthropicModels(apiKey, fetchImpl);
    case "gemini":
      return discoverGoogleModels(apiKey, fetchImpl);
  }
  throw new Error("unsupported catalog provider");
}

async function discoverOpenAIModels(
  apiKey: string,
  fetchImpl: ModelCatalogFetch,
): Promise<readonly DiscoveredModel[]> {
  const response = await fetchImpl(OPENAI_MODELS_URL, {
    headers: { Authorization: `Bearer ${apiKey}` },
    method: "GET",
  });
  if (!response.ok) throw new Error("catalog unavailable");
  const payload: unknown = await response.json();
  const data = recordArray(payload, "data");
  if (data === null) throw new TypeError("unexpected catalog shape");
  return uniqueModels(
    data
      .map((item) => normalizeOpenAIModel(item))
      .filter((model): model is DiscoveredModel => model !== null),
  );
}

async function discoverAnthropicModels(
  apiKey: string,
  fetchImpl: ModelCatalogFetch,
): Promise<readonly DiscoveredModel[]> {
  const models: DiscoveredModel[] = [];
  let afterId: string | undefined;
  for (let page = 0; page < MAX_MODEL_CATALOG_PAGES; page += 1) {
    const url = new URL(ANTHROPIC_MODELS_URL);
    url.searchParams.set("limit", "1000");
    if (afterId !== undefined) url.searchParams.set("after_id", afterId);
    const response = await fetchImpl(url.toString(), {
      headers: {
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      },
      method: "GET",
    });
    if (!response.ok) throw new Error("catalog unavailable");
    const payload: unknown = await response.json();
    const normalized = normalizeAnthropicPage(payload);
    if (normalized === null) throw new TypeError("unexpected catalog shape");
    models.push(...normalized.models);
    if (!normalized.hasMore) return uniqueModels(models);
    if (normalized.lastId === null || normalized.lastId === afterId) {
      throw new TypeError("invalid catalog cursor");
    }
    afterId = normalized.lastId;
  }
  throw new TypeError("catalog pagination limit exceeded");
}

async function discoverGoogleModels(
  apiKey: string,
  fetchImpl: ModelCatalogFetch,
): Promise<readonly DiscoveredModel[]> {
  const models: DiscoveredModel[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_MODEL_CATALOG_PAGES; page += 1) {
    const url = new URL(GOOGLE_MODELS_URL);
    url.searchParams.set("pageSize", "1000");
    if (pageToken !== undefined) url.searchParams.set("pageToken", pageToken);
    const response = await fetchImpl(url.toString(), {
      headers: { "x-goog-api-key": apiKey },
      method: "GET",
    });
    if (!response.ok) throw new Error("catalog unavailable");
    const payload: unknown = await response.json();
    const normalized = normalizeGooglePage(payload);
    if (normalized === null) throw new TypeError("unexpected catalog shape");
    models.push(...normalized.models);
    if (normalized.nextPageToken === null) return uniqueModels(models);
    if (normalized.nextPageToken === pageToken) throw new TypeError("invalid catalog cursor");
    pageToken = normalized.nextPageToken;
  }
  throw new TypeError("catalog pagination limit exceeded");
}

function normalizeOpenRouterModels(payload: unknown): readonly DiscoveredModel[] | null {
  const data = recordArray(payload, "data");
  if (data === null) return null;
  return uniqueModels(
    data
      .map((item) => normalizeOpenRouterModel(item))
      .filter((model): model is DiscoveredModel => model !== null),
  );
}

function normalizeOpenRouterModel(item: unknown): DiscoveredModel | null {
  if (!isRecord(item)) return null;
  const id = normalizeNonEmptyString(item.id);
  if (id === null || !supportsMazelingoStructuredOutput(item.supported_parameters)) return null;
  if (
    !hasTextOutput(isRecord(item.architecture) ? item.architecture.output_modalities : undefined)
  ) {
    return null;
  }
  return {
    id: `openrouter/${id}`,
    name: normalizeNonEmptyString(item.name) ?? id,
  };
}

function normalizeOpenAIModel(item: unknown): DiscoveredModel | null {
  if (!isRecord(item)) return null;
  const id = normalizeNonEmptyString(item.id);
  if (id === null || !isKnownOpenAIChatModelId(id)) return null;
  return { id, name: id };
}

interface AnthropicPage {
  readonly hasMore: boolean;
  readonly lastId: string | null;
  readonly models: readonly DiscoveredModel[];
}

function normalizeAnthropicPage(payload: unknown): AnthropicPage | null {
  if (!isRecord(payload) || !Array.isArray(payload.data) || typeof payload.has_more !== "boolean") {
    return null;
  }
  const lastId = normalizeCursor(payload.last_id);
  if (payload.has_more && lastId === null) return null;
  return {
    hasMore: payload.has_more,
    lastId,
    models: payload.data
      .map((item) => normalizeAnthropicModel(item))
      .filter((model): model is DiscoveredModel => model !== null),
  };
}

function normalizeAnthropicModel(item: unknown): DiscoveredModel | null {
  if (!isRecord(item)) return null;
  const id = normalizeNonEmptyString(item.id);
  if (id === null || !id.startsWith("claude-")) return null;
  return { id, name: normalizeNonEmptyString(item.display_name) ?? id };
}

interface GooglePage {
  readonly models: readonly DiscoveredModel[];
  readonly nextPageToken: string | null;
}

function normalizeGooglePage(payload: unknown): GooglePage | null {
  if (!isRecord(payload) || !Array.isArray(payload.models)) return null;
  let nextPageToken: string | null = null;
  if (payload.nextPageToken !== undefined && payload.nextPageToken !== null) {
    nextPageToken = normalizeNonEmptyString(payload.nextPageToken);
    if (nextPageToken === null) return null;
  }
  return {
    models: payload.models
      .map((item) => normalizeGoogleModel(item))
      .filter((model): model is DiscoveredModel => model !== null),
    nextPageToken,
  };
}

function normalizeGoogleModel(item: unknown): DiscoveredModel | null {
  if (!isRecord(item)) return null;
  const id = normalizeNonEmptyString(item.baseModelId);
  const supportedMethods = item.supportedGenerationMethods;
  if (
    id === null ||
    !id.startsWith("gemini-") ||
    !Array.isArray(supportedMethods) ||
    !supportedMethods.every((method) => typeof method === "string") ||
    !supportedMethods.includes("generateContent")
  ) {
    return null;
  }
  return { id, name: normalizeNonEmptyString(item.displayName) ?? id };
}

function selectedProviderDefinitions(
  requestedProviders: readonly CatalogProviderId[] | undefined,
): readonly CatalogProviderDefinition[] {
  if (requestedProviders === undefined) return CATALOG_PROVIDER_DEFINITIONS;
  const requested = new Set(
    requestedProviders.filter((provider): provider is CatalogProviderId =>
      isCatalogProviderId(provider),
    ),
  );
  return CATALOG_PROVIDER_DEFINITIONS.filter((definition) => requested.has(definition.id));
}

function overallStatus(results: readonly CatalogProviderResult[]): CatalogStatus {
  if (results.some((result) => result.status === "ready")) return "ready";
  if (results.some((result) => result.status === "failed")) return "failed";
  return "not-configured";
}

function emptyDiscovery(status: Exclude<CatalogStatus, "ready">): OpenRouterModelDiscoveryResult {
  return { models: [], status };
}

function normalizeApiKey(apiKey: string | undefined): string | null {
  if (typeof apiKey !== "string") return null;
  const normalized = apiKey.trim();
  return normalized === "" ? null : normalized;
}

function normalizeCursor(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return normalizeNonEmptyString(value);
}

function uniqueModels(models: readonly DiscoveredModel[]): readonly DiscoveredModel[] {
  const ids = new Set<string>();
  return models.filter((model) => {
    if (ids.has(model.id)) return false;
    ids.add(model.id);
    return true;
  });
}

function supportsMazelingoStructuredOutput(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every((parameter) => typeof parameter === "string") &&
    value.includes("structured_outputs") &&
    value.includes("response_format")
  );
}

function hasTextOutput(value: unknown): boolean {
  if (value === undefined) return true;
  return Array.isArray(value) && value.includes("text");
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function recordArray(value: unknown, key: string): readonly unknown[] | null {
  return isRecord(value) && Array.isArray(value[key]) ? value[key] : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
