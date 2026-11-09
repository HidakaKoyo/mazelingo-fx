export interface TranslationCacheContext {
  readonly mode: string;
  readonly model: string;
}

export function modelChainCacheContext(models: readonly string[]): TranslationCacheContext {
  return { mode: "model-chain", model: models.join("\u0000") };
}

export function buildTranslationCacheKey(
  html: string,
  from: string,
  to: string,
  context: Readonly<TranslationCacheContext>,
): string {
  return JSON.stringify([from, to, context.mode, context.model, html]);
}
