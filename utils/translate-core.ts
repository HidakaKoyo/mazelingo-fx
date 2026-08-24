import { TRANSLATION_SCHEMA } from "./llm";
import type { callLLMChain } from "./llm";
import {
  LANG_NAMES,
  buildResplitMessages,
  buildTranslationMessages,
  isLongTranslationUnit,
  reconcileIndexedBlocks,
  sourcesRejoin,
} from "./translation";
import type { Config } from "./config";
import type { TranslationCache } from "./cache";
import type { IndexedBlock, TranslationBlock, TranslationUnit } from "./messages";

export interface TranslateDeps {
  getConfig(): Promise<Config>;
  cache: Readonly<TranslationCache>;
  llm: typeof callLLMChain;
}

export interface LangPair {
  fromName: string;
  toName: string;
}
interface ResplitResult {
  blocks?: { sentences?: TranslationBlock["sentences"] }[];
}
export interface BatchOutcome {
  missing: readonly number[];
  accepted: ReadonlyMap<number, ReadonlyTranslationBlock>;
}
export type ReadonlyConfig = Readonly<
  Omit<Config, "models" | "apiKeys"> & {
    models: readonly string[];
    apiKeys: Readonly<Record<string, string>>;
  }
>;
export type ReadonlyTranslationBlock = Readonly<{
  sentences: readonly Readonly<TranslationUnit>[];
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function isResplitResult(value: unknown): value is ResplitResult {
  return isRecord(value);
}
export function namesFor(from: string, to: string): LangPair {
  return { fromName: LANG_NAMES[from] ?? from, toName: LANG_NAMES[to] ?? to };
}
async function resplitLongUnit(
  unit: Readonly<TranslationUnit>,
  fromName: string,
  toName: string,
  deps: Readonly<TranslateDeps>,
  config: Readonly<ReadonlyConfig>,
): Promise<TranslationBlock["sentences"]> {
  const messages = buildResplitMessages(unit.source, fromName, toName);
  const llmResult: unknown = await deps.llm(
    config.models,
    messages,
    config.apiKeys,
    TRANSLATION_SCHEMA,
  );
  const result = isResplitResult(llmResult) ? llmResult : undefined;
  const sentences = result?.blocks?.[0]?.sentences;
  const rejoin = sourcesRejoin(sentences, unit.source);
  if (result?.blocks?.length === 1 && sentences && sentences.length >= 2 && rejoin) {
    return sentences;
  }
  console.warn("[mlg:bg] long-unit re-split rejected; keeping original unit", {
    blockCount: result?.blocks?.length,
    sourcesRejoin: rejoin,
    unitCount: sentences?.length,
  });
  return [unit];
}

export async function resplitBlock(
  block: ReadonlyTranslationBlock,
  fromName: string,
  toName: string,
  deps: Readonly<TranslateDeps>,
  config: Readonly<ReadonlyConfig>,
): Promise<ReadonlyTranslationBlock> {
  const resolved = await Promise.all(
    block.sentences.map((unit) =>
      isLongTranslationUnit(unit.source)
        ? resplitLongUnit(unit, fromName, toName, deps, config)
        : Promise.resolve([unit]),
    ),
  );
  const resplitSentences: TranslationUnit[] = [];
  for (const sentences of resolved) {
    resplitSentences.push(...sentences);
  }
  return { sentences: resplitSentences };
}

async function batchTranslate(
  indexedBlocks: ReadonlyArray<Readonly<{ html: string; i: number }>>,
  fromIndices: readonly number[],
  fromName: string,
  toName: string,
  deps: Readonly<TranslateDeps>,
  config: Readonly<ReadonlyConfig>,
): Promise<BatchOutcome> {
  const accepted = new Map<number, ReadonlyTranslationBlock>();
  let missing: readonly number[] = fromIndices;
  try {
    const messages = buildTranslationMessages(indexedBlocks, fromName, toName);
    const llmResult: unknown = await deps.llm(
      config.models,
      messages,
      config.apiKeys,
      TRANSLATION_SCHEMA,
    );
    const rawBlocks = isRecord(llmResult) ? llmResult.blocks : undefined;
    const reconciliation = reconcileIndexedBlocks(rawBlocks, fromIndices);
    for (const [index, block] of reconciliation.acceptedBlocks) {
      accepted.set(index, block);
    }
    missing = reconciliation.missingIndices;
    if (missing.length > 0 || reconciliation.outOfRangeIndices.length > 0) {
      console.warn("[mlg:bg] translate error: incomplete indexed response", {
        acceptedCount: reconciliation.acceptedBlocks.size,
        duplicateIndices: reconciliation.duplicateIndices,
        expectedCount: fromIndices.length,
        failedCount: missing.length,
        invalidIndices: reconciliation.invalidIndices,
        missingIndices: missing,
        outOfRangeIndices: reconciliation.outOfRangeIndices,
        receivedCount: reconciliation.receivedCount,
      });
    }
  } catch (error) {
    console.warn("[mlg:bg] translate error: batch call failed; retrying individually", {
      error: error instanceof Error ? error.message : String(error),
      failedCount: missing.length,
      missingIndices: missing,
    });
  }
  return { missing, accepted };
}

async function retryOne(
  index: number,
  indexedBlocks: ReadonlyArray<Readonly<{ html: string; i: number }>>,
  fromName: string,
  toName: string,
  deps: Readonly<TranslateDeps>,
  config: Readonly<ReadonlyConfig>,
): Promise<ReadonlyMap<number, ReadonlyTranslationBlock>> {
  const accepted = new Map<number, ReadonlyTranslationBlock>();
  const indexedBlock = indexedBlocks[index];
  if (indexedBlock === undefined) {
    return accepted;
  }
  try {
    const retryMessages = buildTranslationMessages([indexedBlock], fromName, toName);
    const retryResult: unknown = await deps.llm(
      config.models,
      retryMessages,
      config.apiKeys,
      TRANSLATION_SCHEMA,
    );
    const rawBlocks = isRecord(retryResult) ? retryResult.blocks : undefined;
    const reconciliation = reconcileIndexedBlocks(rawBlocks, [index]);
    const block = reconciliation.acceptedBlocks.get(index);
    if (block) {
      accepted.set(index, block);
    } else {
      console.warn("[mlg:bg] translate fragment failed after individual retry", {
        duplicateIndices: reconciliation.duplicateIndices,
        failedCount: 1,
        invalidIndices: reconciliation.invalidIndices,
        missingIndices: [index],
        outOfRangeIndices: reconciliation.outOfRangeIndices,
        receivedCount: reconciliation.receivedCount,
      });
    }
  } catch (error) {
    console.warn("[mlg:bg] translate fragment failed after individual retry", {
      error: error instanceof Error ? error.message : String(error),
      failedCount: 1,
      missingIndices: [index],
    });
  }
  return accepted;
}

export async function translateUncached(
  blocks: ReadonlyArray<Readonly<IndexedBlock>>,
  fromName: string,
  toName: string,
  deps: Readonly<TranslateDeps>,
  config: Readonly<ReadonlyConfig>,
): Promise<ReadonlyArray<ReadonlyTranslationBlock | null>> {
  const expected = blocks.map((_, index) => index);
  const indexedBlocks = blocks.map((htmlBlock, i) => ({ html: htmlBlock.html, i }));
  const outcome = await batchTranslate(indexedBlocks, expected, fromName, toName, deps, config);
  const retried = await Promise.all(
    outcome.missing.map((index) => retryOne(index, indexedBlocks, fromName, toName, deps, config)),
  );
  const accepted = new Map<number, ReadonlyTranslationBlock>();
  for (const [index, block] of outcome.accepted) accepted.set(index, block);
  for (const map of retried) for (const [index, block] of map) accepted.set(index, block);
  const unresolved = expected.filter((index) => !accepted.has(index));
  if (unresolved.length > 0) {
    console.warn("[mlg:bg] translate completed with failed fragments", {
      failedCount: unresolved.length,
      missingIndices: unresolved,
    });
  }
  const fresh = expected.map((index) => accepted.get(index) ?? null);
  return Promise.all(
    fresh.map((block) =>
      block === null ? Promise.resolve(null) : resplitBlock(block, fromName, toName, deps, config),
    ),
  );
}
