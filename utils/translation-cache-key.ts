export interface TranslationCacheContext {
  readonly mode: string;
  readonly model: string;
}

export function modelChainCacheContext(models: readonly string[]): TranslationCacheContext {
  return { mode: "model-chain", model: models.join("\u0000") };
}

export function plamoCacheContext(model: string, baseUrl: string): TranslationCacheContext {
  return { mode: "plamo", model: `${model}\u0000${baseUrl.trim()}` };
}

export function localModelCacheContext(model: string, baseUrl: string): TranslationCacheContext {
  return { mode: "local-model", model: `${model}\u0000${baseUrl.trim()}` };
}

export function buildTranslationCacheKey(
  html: string,
  from: string,
  to: string,
  context: Readonly<TranslationCacheContext>,
): string {
  return JSON.stringify([from, to, context.mode, context.model, html]);
}
