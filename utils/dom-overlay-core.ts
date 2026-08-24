/**
 * Core DOM overlay: shared constants, node-meta types, and primitive DOM
 * helpers used across the overlay modules. The pure helpers are exported so
 * they can be unit-tested in isolation.
 *
 * Type note: `mlg*` properties on DOM nodes are convention-based. They are
 * attached here and read by the content entrypoint; TS has no structural type
 * for them, so they are accessed through casts in this module.
 */

export const MLG_ATOM_TAGS = new Set([
  "svg",
  "img",
  "video",
  "canvas",
  "input",
  "select",
  "textarea",
  "iframe",
]);
export const MLG_IGNORED_TAGS = new Set(["script", "style", "noscript", "template"]);
export const MLG_PLACEHOLDER_PATTERN = /⟦(\d+)⟧/gu;

export type NodeWithMeta = Node & {
  mlgIsAtom?: boolean;
  mlgAtomNumber?: number;
  mlgAtoms?: Map<number, Node>;
  mlgAtomNumbers?: number[];
  mlgOriginal?: DocumentFragment;
  mlgBlockAtoms?: Readonly<Map<number, Node>> | null;
};

export type MlgSpan = NodeWithMeta & HTMLElement;

export type MlgNode = Node | null | undefined;

export interface MlgBoundary {
  container: Node | null;
  offset: number;
}

export function mlgTagName(node: MlgNode): string {
  return node instanceof Element && typeof node.tagName === "string"
    ? node.tagName.toLowerCase()
    : "";
}

export function isMlgIgnoredElement(element: MlgNode): boolean {
  return (
    element?.nodeType === 1 &&
    (MLG_IGNORED_TAGS.has(mlgTagName(element)) ||
      (element instanceof Element && element.getAttribute?.("aria-hidden") === "true"))
  );
}

export function isMlgAtom(element: MlgNode): boolean {
  if (element?.nodeType !== 1) {
    return false;
  }
  const meta = element as NodeWithMeta;
  if (typeof meta.mlgIsAtom === "boolean") {
    return meta.mlgIsAtom;
  }
  return (
    MLG_ATOM_TAGS.has(mlgTagName(element)) ||
    (element instanceof Element && (element.textContent ?? "").trim() === "")
  );
}

export function mlgChildNodes(node: MlgNode): Node[] {
  return Array.from(node?.childNodes ?? []);
}

export function boundaryBeforeNode(node: MlgNode): MlgBoundary | null {
  const parent = node?.parentNode;
  if (!parent) {
    return null;
  }
  const offset = mlgChildNodes(parent).indexOf(node);
  return offset === -1 ? null : { container: parent, offset };
}

export function boundaryAfterNode(node: MlgNode): MlgBoundary | null {
  const before = boundaryBeforeNode(node);
  return before ? { container: before.container, offset: before.offset + 1 } : null;
}
