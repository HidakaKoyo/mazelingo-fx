import { isMlgAtom, mlgChildNodes, MLG_PLACEHOLDER_PATTERN } from "./dom-overlay-core";
import type { MlgSpan } from "./dom-overlay-core";
import {
  buildElementIndex,
  cloneFragmentWithMetadata,
  hydrateOriginalAtoms,
  ownerDocumentFor,
  parseVariantFragment,
  variantTagSequencesMatch,
} from "./dom-overlay-render-util";

function removeTextNodes(root: Node): void {
  const textNodes: Text[] = [];
  function visit(node: Node): void {
    mlgChildNodes(node).forEach((child) => {
      if (child instanceof Text) {
        textNodes.push(child);
      } else if (child.nodeType === 1 || child.nodeType === 11) {
        visit(child);
      }
    });
  }
  visit(root);
  textNodes.forEach((node) => {
    node.remove();
  });
}

function appendTextWithAtoms(
  documentRef: Document,
  target: Node,
  before: Node | null,
  text: string,
  atoms: Readonly<Map<number, Node>> | undefined,
  usedAtoms: Set<number>,
): void {
  const fragment = documentRef.createDocumentFragment();
  let cursor = 0;
  MLG_PLACEHOLDER_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MLG_PLACEHOLDER_PATTERN.exec(text)) !== null) {
    if (match.index > cursor) {
      fragment.append(documentRef.createTextNode(text.slice(cursor, match.index)));
    }
    const number = Number(match[1]);
    const atom = atoms?.get(number);
    if (atom) {
      fragment.append(atom);
      usedAtoms.add(number);
    } else {
      fragment.append(documentRef.createTextNode(match[0]));
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    fragment.append(documentRef.createTextNode(text.slice(cursor)));
  }
  target.insertBefore(fragment, before ?? null);
}

function collectTextPlacements(node: Node): Text[] {
  const placements: Text[] = [];
  mlgChildNodes(node).forEach((child) => {
    if (child instanceof Text) {
      placements.push(child);
    } else if (child instanceof Element && !isMlgAtom(child)) {
      placements.push(...collectTextPlacements(child));
    }
  });
  return placements;
}

function placeTextNode(
  textNode: Text,
  original: DocumentFragment,
  originalElements: readonly Element[],
  variantElementIndexes: ReadonlyMap<Element, number>,
  documentRef: Document,
  atoms: Readonly<Map<number, Node>> | undefined,
  usedAtoms: Set<number>,
): void {
  const variantParent = textNode.parentNode;
  let targetParent: Node | null | undefined = undefined;
  if (variantParent instanceof DocumentFragment) {
    targetParent = original;
  } else if (variantParent instanceof Element) {
    const parentIndex = variantElementIndexes.get(variantParent);
    targetParent = parentIndex === undefined ? original : originalElements[parentIndex];
  }
  if (!targetParent) {
    return;
  }
  let nextElement: Node | null = textNode.nextSibling;
  while (nextElement && (nextElement.nodeType !== 1 || isMlgAtom(nextElement))) {
    nextElement = nextElement.nextSibling;
  }
  const nextIndex =
    nextElement instanceof Element ? variantElementIndexes.get(nextElement) : undefined;
  const targetBefore = nextIndex === undefined ? null : originalElements[nextIndex];
  appendTextWithAtoms(
    documentRef,
    targetParent,
    targetBefore?.parentNode === targetParent ? targetBefore : null,
    textNode.data,
    atoms,
    usedAtoms,
  );
}

function renderMatchingVariant(
  original: DocumentFragment,
  variant: DocumentFragment,
  span: MlgSpan,
  atoms: Readonly<Map<number, Node>> | undefined,
): void {
  const documentRef = ownerDocumentFor(span);
  if (!documentRef) {
    throw new Error("[mlg:overlay] ownerDocument is required");
  }
  const originalElements = buildElementIndex(original),
    textPlacements = collectTextPlacements(variant),
    usedAtoms = new Set<number>(),
    variantElementIndexes = new Map(
      buildElementIndex(variant).map((element, index) => [element, index] as const),
    );
  collectTextPlacements(variant);
  removeTextNodes(original);
  textPlacements.forEach((textNode) => {
    placeTextNode(
      textNode,
      original,
      originalElements,
      variantElementIndexes,
      documentRef,
      atoms,
      usedAtoms,
    );
  });
}

function findFirstText(node: Node): Text | null {
  for (const child of mlgChildNodes(node)) {
    if (child instanceof Text) {
      return child;
    }
    if (child instanceof Element && !isMlgAtom(child)) {
      const nested = findFirstText(child);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

function renderFallbackVariant(
  original: DocumentFragment,
  variant: DocumentFragment,
  span: MlgSpan,
  atoms: Readonly<Map<number, Node>> | undefined,
): void {
  const documentRef = ownerDocumentFor(span);
  if (!documentRef) {
    throw new Error("[mlg:overlay] ownerDocument is required");
  }
  const firstText = findFirstText(original);
  const targetParent = firstText?.parentNode ?? original;
  const targetBefore = firstText?.nextSibling ?? null;
  const ownedNumbers = Array.isArray(span.mlgAtomNumbers) ? span.mlgAtomNumbers : [];
  const ownedAtoms = ownedNumbers
    .map((number) => [number, atoms?.get(number)] as const)
    .filter((entry) => entry[1]);
  removeTextNodes(original);
  ownedAtoms.forEach(([, atom]) => {
    if (atom instanceof Element) {
      atom.remove();
    }
  });
  const usedAtoms = new Set<number>();
  appendTextWithAtoms(
    documentRef,
    targetParent,
    targetBefore?.parentNode === targetParent ? targetBefore : null,
    variant.textContent ?? "",
    atoms,
    usedAtoms,
  );
  ownedAtoms.forEach(([number, atom]) => {
    if (atom instanceof Element && !usedAtoms.has(number)) {
      targetParent.append(atom);
    }
  });
}

export function renderVariant(
  span: MlgSpan,
  variantHtml: unknown,
  atoms?: Readonly<Map<number, Node>>,
): void {
  const documentRef = ownerDocumentFor(span);
  if (!documentRef || !span.mlgOriginal) {
    throw new Error("[mlg:overlay] renderVariant requires a wrapped span");
  }
  const atomMap = atoms ?? span.mlgAtoms ?? new Map<number, Node>(),
    original = hydrateOriginalAtoms(cloneFragmentWithMetadata(span.mlgOriginal), span, atomMap),
    variant = parseVariantFragment(documentRef, variantHtml);
  if (variantTagSequencesMatch(original, variant)) {
    renderMatchingVariant(original, variant, span, atomMap);
  } else {
    renderFallbackVariant(original, variant, span, atomMap);
  }
  span.replaceChildren(original);
}

export function renderOriginal(span: MlgSpan): void {
  if (!span?.mlgOriginal) {
    throw new Error("[mlg:overlay] renderOriginal requires a wrapped span");
  }
  const original = hydrateOriginalAtoms(
    cloneFragmentWithMetadata(span.mlgOriginal),
    span,
    span.mlgAtoms ?? new Map(),
  );
  span.replaceChildren(original);
}
