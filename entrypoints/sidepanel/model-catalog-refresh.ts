import { CATALOG_PROVIDER_IDS, type CatalogProviderId } from "@/utils/model-catalog";

export type { CatalogProviderId };

type ApiKeyConfig = Readonly<{
  apiKeys: Readonly<Record<string, string>>;
}>;

export function getChangedCatalogProviders(
  previous: ApiKeyConfig | null,
  next: ApiKeyConfig,
): readonly CatalogProviderId[] {
  if (previous === null) return [];
  return CATALOG_PROVIDER_IDS.filter(
    (provider) =>
      (previous.apiKeys[provider] ?? "").trim() !== (next.apiKeys[provider] ?? "").trim(),
  );
}

export function hasOpenRouterApiKeyChanged(
  previous: ApiKeyConfig | null,
  next: ApiKeyConfig,
): boolean {
  return getChangedCatalogProviders(previous, next).includes("openrouter");
}
