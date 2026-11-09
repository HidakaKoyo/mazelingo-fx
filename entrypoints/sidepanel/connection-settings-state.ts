import type { Config } from "@/utils/config";
import type { translationModeTranslations } from "./translation-mode-translations";

type ConnectionTranslations = (typeof translationModeTranslations)["ja"];

export interface ConnectionSettingsState {
  readonly connectedProviderCount: number;
  readonly customServerUrl: string;
  readonly hasModelChain: boolean;
  readonly translationMode: Config["translationMode"];
}

export interface ConnectionSummaries {
  readonly customServer: string;
  readonly provider: string;
}

function customServerAddress(url: string, fallback: string): string {
  try {
    return new URL(url).host || fallback;
  } catch {
    return fallback;
  }
}

export function connectionSummaries(
  state: Readonly<ConnectionSettingsState>,
  t: Readonly<ConnectionTranslations>,
): ConnectionSummaries {
  const usesProvider = state.translationMode === "model-chain";
  const providerUse = usesProvider ? t.providerUseTranslation : t.providerUseTools;
  const providerState = state.hasModelChain
    ? state.connectedProviderCount === 0
      ? t.providerDisconnected
      : t.providerConnected(state.connectedProviderCount)
    : t.modelsMissing;
  const customServerUse = usesProvider ? t.customServerUnused : t.customServerUseTranslation;
  const customServerState = customServerAddress(state.customServerUrl, t.customServerUrlMissing);
  return {
    customServer: `${customServerUse} · ${customServerState}`,
    provider: `${providerUse} · ${providerState}`,
  };
}
