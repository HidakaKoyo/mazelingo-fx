export interface ModelCatalogEntry {
  readonly id: string;
  readonly name: string;
}

export interface ModelCatalogGroup {
  readonly vendor: string | null;
  readonly models: readonly GroupedModelCatalogEntry[];
}

export interface GroupedModelCatalogEntry extends ModelCatalogEntry {
  readonly isLatestAlias: boolean;
}

const OPENROUTER_PREFIX = "openrouter/";

const OPENROUTER_VENDOR_NAMES: Readonly<Record<string, string>> = {
  "01-ai": "01.AI",
  ai21: "AI21",
  alibaba: "Alibaba",
  amazon: "Amazon",
  anthropic: "Anthropic",
  baidu: "Baidu",
  bytedance: "ByteDance",
  cohere: "Cohere",
  deepseek: "DeepSeek",
  google: "Google",
  "meta-llama": "Meta",
  microsoft: "Microsoft",
  minimax: "MiniMax",
  mistralai: "Mistral AI",
  moonshotai: "Moonshot AI",
  nvidia: "NVIDIA",
  openai: "OpenAI",
  perplexity: "Perplexity",
  qwen: "Qwen",
  "x-ai": "xAI",
  "z-ai": "Z.AI",
};

/**
 * Groups OpenRouter model IDs by their vendor segment for native select
 * optgroups. Models with an unfamiliar identifier remain selectable in the
 * final group instead of being dropped.
 */
export function groupModelsByVendor(
  models: readonly ModelCatalogEntry[],
): readonly ModelCatalogGroup[] {
  const grouped = new Map<string | null, GroupedModelCatalogEntry[]>();
  for (const model of models) {
    const vendor = vendorFromModelId(model.id);
    const groupedModel = {
      ...model,
      isLatestAlias: isOpenRouterLatestAlias(model.id),
    };
    const group = grouped.get(vendor);
    if (group === undefined) {
      grouped.set(vendor, [groupedModel]);
    } else {
      group.push(groupedModel);
    }
  }

  return [...grouped.entries()]
    .toSorted(([left], [right]) => compareVendor(left, right))
    .map(([vendor, entries]) => ({
      models: entries.toSorted(compareModels),
      vendor,
    }));
}

function vendorFromModelId(id: string): string | null {
  if (!id.startsWith(OPENROUTER_PREFIX)) return null;

  const [vendor, model] = id.slice(OPENROUTER_PREFIX.length).split("/", 2);
  if (vendor === undefined || vendor === "" || model === undefined || model === "") {
    return null;
  }
  return isOpenRouterLatestAlias(id) ? vendor.slice(1) : vendor;
}

export function isOpenRouterLatestAlias(id: string): boolean {
  const [vendor, model] = id.slice(OPENROUTER_PREFIX.length).split("/", 2);
  return (
    id.startsWith(OPENROUTER_PREFIX) &&
    vendor !== undefined &&
    vendor.startsWith("~") &&
    vendor.length > 1 &&
    model !== undefined &&
    model.endsWith("-latest")
  );
}

export interface SplitModelCatalog {
  readonly fixed: readonly ModelCatalogEntry[];
  readonly latest: readonly ModelCatalogEntry[];
}

/** Splits the compact latest choices from version-pinned catalog choices. */
export function splitModelCatalog(models: readonly ModelCatalogEntry[]): SplitModelCatalog {
  return {
    fixed: models.filter((model) => !isOpenRouterLatestAlias(model.id)),
    latest: models.filter((model) => isOpenRouterLatestAlias(model.id)),
  };
}

export function openRouterVendorLabel(vendor: string): string {
  return OPENROUTER_VENDOR_NAMES[vendor] ?? vendor;
}

export function modelCatalogLabel(model: ModelCatalogEntry): string {
  const vendor = vendorFromModelId(model.id);
  return vendor === null
    ? model.name
    : stripVendorPrefix(model.name, openRouterVendorLabel(vendor));
}

function stripVendorPrefix(name: string, vendorName: string): string {
  let nameIndex = 0;
  for (const vendorCharacter of vendorName) {
    if (!isAsciiAlphaNumeric(vendorCharacter)) continue;

    while (true) {
      const nameCharacter = name.at(nameIndex);
      if (nameCharacter === undefined || isAsciiAlphaNumeric(nameCharacter)) break;
      nameIndex += 1;
    }
    const nameCharacter = name.at(nameIndex);
    if (
      nameCharacter === undefined ||
      nameCharacter.toLocaleLowerCase("en") !== vendorCharacter.toLocaleLowerCase("en")
    ) {
      return name;
    }
    nameIndex += 1;
  }

  const nextCharacter = name.at(nameIndex);
  if (nextCharacter !== undefined && !/^[\s:：]$/u.test(nextCharacter)) {
    return name;
  }

  const withoutPrefix = name.slice(nameIndex).replace(/^[\s:：]+/u, "");
  return withoutPrefix || name;
}

function isAsciiAlphaNumeric(value: string): boolean {
  return /^[a-z0-9]$/iu.test(value);
}

function compareVendor(left: string | null, right: string | null): number {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return compareText(left, right);
}

function compareModels(left: GroupedModelCatalogEntry, right: GroupedModelCatalogEntry): number {
  return compareText(left.name, right.name) || compareText(left.id, right.id);
}

function compareText(left: string, right: string): number {
  const normalizedLeft = left.toLocaleLowerCase("en");
  const normalizedRight = right.toLocaleLowerCase("en");
  return normalizedLeft < normalizedRight ? -1 : normalizedLeft > normalizedRight ? 1 : 0;
}
