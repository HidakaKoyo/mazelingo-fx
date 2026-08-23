import { isMlgAtom, mlgChildNodes, mlgTagName } from "./dom-overlay-core";
import type { MlgNode, MlgSpan, NodeWithMeta } from "./dom-overlay-core";

export function ownerDocumentFor(node: MlgNode): Document | null {
  if (node?.nodeType === 9) {
    return node instanceof Document ? node : null;
  }
  return node?.ownerDocument ?? null;
}

export function cloneChildFragment(node: Node): DocumentFragment {
  const documentRef = ownerDocumentFor(node);
  if (!documentRef) {
    throw new Error("[mlg:overlay] ownerDocument is required");
  }
  const fragment = documentRef.createDocumentFragment();
  mlgChildNodes(node).forEach((child) => {
    const clone = child.cloneNode(true);
    copyMlgNodeMetadata(child, clone);
    fragment.append(clone);
  });
  return fragment;
}

export function copyMlgNodeMetadata(source: Node, clone: Node): void {
  const cloneMeta = clone as NodeWithMeta,
    sourceMeta = source as NodeWithMeta;
  if (typeof sourceMeta.mlgIsAtom === "boolean") {
    cloneMeta.mlgIsAtom = sourceMeta.mlgIsAtom;
  }
  const cloneChildren = mlgChildNodes(clone),
    sourceChildren = mlgChildNodes(source);
  sourceChildren.forEach((child, index) => {
    const cloneChild = cloneChildren[index];
    if (cloneChild) {
      copyMlgNodeMetadata(child, cloneChild);
    }
  });
}

export function cloneFragmentWithMetadata(fragment: DocumentFragment): DocumentFragment {
  const clone = fragment.cloneNode(true);
  if (!(clone instanceof DocumentFragment)) {
    throw new Error("[mlg:overlay] clone is not a fragment");
  }
  copyMlgNodeMetadata(fragment, clone);
  return clone;
}

export function collectAtomElements(root: Node): Element[] {
  const atoms: Element[] = [];
  function visit(node: Node | null | undefined): void {
    if (node instanceof Element && isMlgAtom(node)) {
      atoms.push(node);
      return;
    }
    mlgChildNodes(node).forEach((child) => {
      visit(child);
    });
  }
  mlgChildNodes(root).forEach((child) => {
    visit(child);
  });
  return atoms;
}

export function wrapRange(range: Range): MlgSpan {
  const documentRef = ownerDocumentFor(range?.startContainer);
  if (!documentRef || typeof range.extractContents !== "function") {
    throw new TypeError("[mlg:overlay] wrapRange requires a DOM Range");
  }
  const extracted = range.extractContents(),
    span = documentRef.createElement("span");
  span.className = "mlg-sentence";
  span.append(extracted);
  const meta = span as NodeWithMeta & HTMLElement;
  meta.mlgAtoms = new Map<number, Node>();
  meta.mlgAtomNumbers = [];
  collectAtomElements(span).forEach((atom) => {
    const atomMeta = atom as NodeWithMeta,
      number = Number(atomMeta.mlgAtomNumber);
    if (!Number.isInteger(number) || number < 1) {
      return;
    }
    meta.mlgAtoms?.set(number, atom);
    meta.mlgAtomNumbers?.push(number);
  });
  meta.mlgOriginal = cloneChildFragment(span);
  range.insertNode(span);
  return meta;
}

export function collectElementTags(root: Node): string[] {
  const tags: string[] = [];
  function visit(node: Node | null | undefined): void {
    if (node instanceof Element) {
      if (isMlgAtom(node)) {
        return;
      }
      tags.push(mlgTagName(node));
    }
    mlgChildNodes(node).forEach((child) => {
      visit(child);
    });
  }
  mlgChildNodes(root).forEach((child) => {
    visit(child);
  });
  return tags;
}

export function variantTagSequencesMatch(originalRoot: Node, variantRoot: Node): boolean {
  const originalTags = collectElementTags(originalRoot),
    variantTags = collectElementTags(variantRoot);
  return (
    originalTags.length === variantTags.length &&
    originalTags.every((tagName, index) => tagName === variantTags[index])
  );
}

export function parseVariantFragment(documentRef: Document, html: unknown): DocumentFragment {
  const template = documentRef.createElement("template");
  template.innerHTML = typeof html === "string" ? html : "";
  const clone = template.content.cloneNode(true);
  if (!(clone instanceof DocumentFragment)) {
    throw new Error("[mlg:overlay] template clone is not a fragment");
  }
  return clone;
}

export function buildElementIndex(root: Node): Element[] {
  const elements: Element[] = [];
  function visit(node: Node | null | undefined): void {
    if (node instanceof Element) {
      if (isMlgAtom(node)) {
        return;
      }
      elements.push(node);
    }
    mlgChildNodes(node).forEach((child) => {
      visit(child);
    });
  }
  mlgChildNodes(root).forEach((child) => {
    visit(child);
  });
  return elements;
}

export function hydrateOriginalAtoms(
  fragment: DocumentFragment,
  span: NodeWithMeta,
  atoms: Readonly<Map<number, Node>> | undefined,
): DocumentFragment {
  const clones = collectAtomElements(fragment),
    numbers = Array.isArray(span.mlgAtomNumbers) ? span.mlgAtomNumbers : [];
  clones.forEach((clone, index) => {
    const number = numbers[index];
    const actual =
      number === undefined ? undefined : (atoms?.get(number) ?? span.mlgAtoms?.get(number));
    if (actual) {
      clone.replaceWith(actual);
    }
  });
  return fragment;
}
