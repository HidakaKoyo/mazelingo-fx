/**
 * Safe, key-scoped model discovery for providers that expose it.
 *
 * This module intentionally returns only normalized display data. It never
 * returns provider response bodies, error text, or the credential supplied to
 * it.
 */

const OPENROUTER_MODELS_URL =
  "https://openrouter.ai/api/v1/models/user?output_modalities=text&limit=1000";

export interface DiscoveredModel {
  readonly id: string;
  readonly name: string;
}

interface ModelCatalogRequestInit {
  readonly headers?: Readonly<Record<string, string>>;
  readonly method?: string;
}

type ModelCatalogFetch = (
  input: string,
  init?: ModelCatalogRequestInit,
) => Promise<Pick<Response, "json" | "ok">>;

export type OpenRouterModelDiscoveryResult =
  | {
      readonly status: "not-configured";
      readonly models: readonly [];
    }
  | {
      readonly status: "failed";
      readonly models: readonly [];
    }
  | {
      readonly status: "ready";
      readonly models: readonly DiscoveredModel[];
    };

interface OpenRouterModelRecord {
  readonly architecture?: {
    readonly output_modalities?: unknown;
  };
  readonly id?: unknown;
  readonly name?: unknown;
  readonly supported_parameters?: unknown;
}

interface OpenRouterModelsResponse {
  readonly data?: unknown;
}

/**
 * Returns only OpenRouter models usable by Mazelingo's JSON-schema translation
 * request. The API key is used solely in the request header and is not exposed
 * in the result, thrown errors, or logging.
 */
export async function discoverOpenRouterModels(
  apiKey: string | undefined,
  fetchImpl: ModelCatalogFetch = fetch,
): Promise<OpenRouterModelDiscoveryResult> {
  const configuredKey = apiKey?.trim();
  if (configuredKey === undefined || configuredKey === "") {
    return emptyResult("not-configured");
  }

  try {
    const response = await fetchImpl(OPENROUTER_MODELS_URL, {
      headers: {
        Authorization: `Bearer ${configuredKey}`,
      },
      method: "GET",
    });
    if (!response.ok) {
      return emptyResult("failed");
    }

    const payload: unknown = await response.json();
    return normalizeOpenRouterModels(payload);
  } catch {
    return emptyResult("failed");
  }
}

function normalizeOpenRouterModels(payload: unknown): OpenRouterModelDiscoveryResult {
  if (!isResponse(payload) || !Array.isArray(payload.data)) {
    return emptyResult("failed");
  }

  const ids = new Set<string>();
  const models: DiscoveredModel[] = [];
  for (const item of payload.data) {
    const model = normalizeModel(item);
    if (!model || ids.has(model.id)) continue;
    ids.add(model.id);
    models.push(model);
  }

  return { models, status: "ready" };
}

function normalizeModel(item: unknown): DiscoveredModel | null {
  if (!isModelRecord(item)) return null;

  const id = normalizeNonEmptyString(item.id);
  if (id === null || !supportsMazelingoStructuredOutput(item.supported_parameters)) {
    return null;
  }
  if (!hasTextOutput(item.architecture?.output_modalities)) return null;

  return {
    id: `openrouter/${id}`,
    name: normalizeNonEmptyString(item.name) ?? id,
  };
}

function supportsMazelingoStructuredOutput(value: unknown): boolean {
  if (!Array.isArray(value) || !value.every((parameter) => typeof parameter === "string")) {
    return false;
  }
  return value.includes("structured_outputs") && value.includes("response_format");
}

function hasTextOutput(value: unknown): boolean {
  if (value === undefined) return true;
  return Array.isArray(value) && value.includes("text");
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function isResponse(value: unknown): value is OpenRouterModelsResponse {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isModelRecord(value: unknown): value is OpenRouterModelRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function emptyResult(
  status: "not-configured" | "failed",
): Extract<OpenRouterModelDiscoveryResult, { readonly status: typeof status }> {
  return { models: [], status };
}
