import type { ProviderEntry } from "./llm-registry";

export const CUSTOM_MODEL_PREFIX = "custom/";
export const LOCAL_MODEL_PREFIX = "local/";
export const LOCAL_REQUEST_TIMEOUT_MS = 120_000;

export interface LocalEndpointConfig {
  baseUrl: string;
  apiKey: string;
}

export const DEFAULT_LOCAL_ENDPOINT: LocalEndpointConfig = {
  apiKey: "",
  baseUrl: "",
};

export interface ResolvedLocalProvider {
  readonly entry: ProviderEntry;
  readonly prefix: typeof CUSTOM_MODEL_PREFIX | typeof LOCAL_MODEL_PREFIX;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function mergeLocalEndpoint(raw: unknown): LocalEndpointConfig {
  if (!isRecord(raw)) {
    return { ...DEFAULT_LOCAL_ENDPOINT };
  }
  return {
    apiKey: typeof raw.apiKey === "string" ? raw.apiKey : DEFAULT_LOCAL_ENDPOINT.apiKey,
    baseUrl: typeof raw.baseUrl === "string" ? raw.baseUrl : DEFAULT_LOCAL_ENDPOINT.baseUrl,
  };
}

export function buildLocalEndpointUrl(baseUrl: string, path: string): string | null {
  const trimmed = baseUrl.trim();
  if (trimmed === "") {
    return null;
  }
  try {
    const url = new URL(trimmed);
    url.pathname = `${url.pathname.replace(/\/+$/u, "")}/${path.replace(/^\/+/u, "")}`;
    url.search = "";
    url.hash = "";
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function resolveLocalProvider(
  modelName: string,
  config: Readonly<LocalEndpointConfig> | undefined,
): ResolvedLocalProvider | null {
  const prefix = ([CUSTOM_MODEL_PREFIX, LOCAL_MODEL_PREFIX] as const).find(
    (candidate) => modelName.startsWith(candidate) && modelName !== candidate,
  );
  if (prefix === undefined) {
    return null;
  }
  const baseUrl =
    config === undefined ? null : buildLocalEndpointUrl(config.baseUrl, "/chat/completions");
  if (baseUrl === null) {
    return null;
  }
  return {
    entry: {
      baseUrl,
      format: "openai",
      omitAuthorizationWhenApiKeyEmpty: true,
      requestTimeoutMs: LOCAL_REQUEST_TIMEOUT_MS,
      stripPrefix: prefix,
    },
    prefix,
  };
}
