/**
 * TranslateBatch orchestration, extracted from the background service worker.
 *
 * Pulls config + cache + LLM as injected deps so the whole flow (cache check →
 * LLM call → reconcile → retry → resplit → cache store) can be tested with a
 * fake storage backend and a mocked LLM, no chrome.* mocks needed.
 */
import { namesFor, translateUncached } from "./translate-core";
import type { ReadonlyTranslationBlock, TranslateDeps } from "./translate-core";
import type { IndexedBlock, TranslatePayload, TranslationBlock } from "./messages";

interface CachedResolution {
  blocks: (TranslationBlock | null)[];
  uncachedIndices: number[];
  uncachedBlocks: IndexedBlock[];
}
type ReadonlyPayload = Readonly<
  Omit<TranslatePayload, "htmlBlocks"> & { htmlBlocks: readonly string[] }
>;

async function resolveCachedBlocks(
  source: ReadonlyArray<Readonly<{ html: string; index: number }>>,
  from: string,
  to: string,
  deps: Readonly<TranslateDeps>,
): Promise<CachedResolution> {
  const blocks: (TranslationBlock | null)[] = Array.from({ length: source.length }, () => null);
  const uncachedIndices: number[] = [];
  const uncachedBlocks: IndexedBlock[] = [];
  const lookups = source.map((item) => deps.cache.lookup(item.html, from, to));
  const entries = await Promise.all(lookups);
  let i = 0;
  for (const item of source) {
    const entry = entries[i] ?? null;
    if (entry) {
      blocks[item.index] = entry.block;
    } else {
      uncachedIndices.push(item.index);
      uncachedBlocks.push({ html: item.html, i: item.index });
    }
    i += 1;
  }
  return { blocks, uncachedIndices, uncachedBlocks };
}

async function storeFresh(
  htmlBlocks: readonly string[],
  uncachedIndices: readonly number[],
  fresh: ReadonlyArray<ReadonlyTranslationBlock | null>,
  from: string,
  to: string,
  deps: Readonly<TranslateDeps>,
): Promise<void> {
  const stores: Promise<void>[] = [];
  for (let i = 0; i < uncachedIndices.length; i++) {
    const idx = uncachedIndices[i];
    const html = idx === undefined ? undefined : htmlBlocks[idx];
    const block = fresh[i] ?? null;
    if (block !== null && block.sentences.length > 0 && html !== undefined) {
      stores.push(deps.cache.store(html, from, to, { sentences: [...block.sentences] }));
    }
  }
  await Promise.all(stores);
}

function buildFinalBlocks(
  cached: ReadonlyArray<ReadonlyTranslationBlock | null>,
  uncachedIndices: readonly number[],
  fresh: ReadonlyArray<ReadonlyTranslationBlock | null>,
): (TranslationBlock | null)[] {
  const merged: (TranslationBlock | null)[] = cached.map((block) =>
    block === null ? null : { sentences: [...block.sentences] },
  );
  for (let i = 0; i < uncachedIndices.length; i++) {
    const idx = uncachedIndices[i];
    const next = fresh[i];
    if (idx !== undefined && next !== null && next !== undefined) {
      merged[idx] = { sentences: [...next.sentences] };
    }
  }
  return merged;
}

export async function translateBatch(
  payload: ReadonlyPayload,
  deps: Readonly<TranslateDeps>,
): Promise<{
  blocks: (TranslationBlock | null)[];
  error?: string;
}> {
  const config = await deps.getConfig();
  console.log("[mlg:bg] translateBatch called", {
    apiKeysPresent: Object.keys(config.apiKeys),
    blockCount: payload.htmlBlocks?.length,
    from: payload.from,
    models: config.models,
    to: payload.to,
  });
  const { htmlBlocks, from, to } = payload;
  if (htmlBlocks.length === 0) {
    return { blocks: [] };
  }
  const resolution = await resolveCachedBlocks(
    htmlBlocks.map((html, index) => ({ html, index })),
    from,
    to,
    deps,
  );
  const cacheHits = htmlBlocks.length - resolution.uncachedBlocks.length;
  if (cacheHits > 0) {
    console.log(`[mlg:bg] cache hit: ${cacheHits}/${htmlBlocks.length} blocks`);
  }
  if (resolution.uncachedBlocks.length === 0) {
    return { blocks: resolution.blocks };
  }
  const { fromName, toName } = namesFor(from, to);
  const fresh = await translateUncached(
    resolution.uncachedBlocks,
    htmlBlocks.length,
    fromName,
    toName,
    deps,
    config,
  );
  await storeFresh(htmlBlocks, resolution.uncachedIndices, fresh, from, to, deps);
  return { blocks: buildFinalBlocks(resolution.blocks, resolution.uncachedIndices, fresh) };
}
