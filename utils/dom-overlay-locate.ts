import { boundaryAfterNode, boundaryBeforeNode, mlgChildNodes } from "./dom-overlay-core";
import type { MlgBoundary, MlgNode } from "./dom-overlay-core";
import { normalizeStreamForMatching, normalizeUnitText } from "./dom-overlay-tokenize";
import type { TokenStream } from "./dom-overlay-tokenize";

export interface LocatedRange {
  startContainer: Node | null;
  startOffset: number;
  endContainer: Node | null;
  endOffset: number;
  startIndex: number;
  endIndex: number;
  nextIndex: number;
}

function nodeIndex(node: MlgNode): number {
  if (node === null || node === undefined) {
    return -1;
  }
  return mlgChildNodes(node.parentNode).indexOf(node);
}

function boundaryInsideElement(
  boundary: Readonly<MlgBoundary> | undefined,
  element: Element,
): boolean {
  let node: Node | null = boundary?.container ?? null;
  while (node) {
    if (node === element) {
      return true;
    }
    node = node.parentNode;
  }
  return false;
}

function boundaryAtElementStart(
  boundary: Readonly<MlgBoundary> | undefined,
  element: Element,
): boolean {
  let container: Node | null = boundary?.container ?? null,
    offset: number | undefined = boundary?.offset;
  while (container && container !== element) {
    if (container.nodeType === 3) {
      if (offset !== 0) {
        return false;
      }
    } else if (offset !== 0) {
      return false;
    }
    const parent = container.parentNode;
    if (!parent || nodeIndex(container) !== 0) {
      return false;
    }
    container = parent;
    offset = 0;
  }
  return container === element && offset === 0;
}

function boundaryAtElementEnd(
  boundary: Readonly<MlgBoundary> | undefined,
  element: Element,
): boolean {
  let container: Node | null = boundary?.container ?? null,
    offset: number | undefined = boundary?.offset;
  while (container && container !== element) {
    const length =
      container.nodeType === 3
        ? (container instanceof Text ? container.data : "").length
        : mlgChildNodes(container).length;
    if (offset !== length) {
      return false;
    }
    const parent = container.parentNode;
    if (!parent || nodeIndex(container) !== mlgChildNodes(parent).length - 1) {
      return false;
    }
    container = parent;
    offset = mlgChildNodes(container).length;
  }
  return container === element && offset === mlgChildNodes(element).length;
}

function promoteStartBoundary(
  start: Readonly<MlgBoundary>,
  end: Readonly<MlgBoundary>,
  root: Element,
): { boundary: MlgBoundary; changed: boolean } {
  if (start.container instanceof Element && start.container !== root && start.offset === 0) {
    const candidate = start.container;
    if (!boundaryInsideElement(end, candidate) || boundaryAtElementEnd(end, candidate)) {
      const promoted = boundaryBeforeNode(candidate);
      if (promoted) {
        return { boundary: promoted, changed: true };
      }
    }
  }
  return { boundary: start, changed: false };
}

function promoteEndBoundary(
  end: Readonly<MlgBoundary>,
  start: Readonly<MlgBoundary>,
  root: Element,
): { boundary: MlgBoundary; changed: boolean } {
  if (
    end.container instanceof Element &&
    end.container !== root &&
    end.offset === mlgChildNodes(end.container).length
  ) {
    const candidate = end.container;
    if (!boundaryInsideElement(start, candidate) || boundaryAtElementStart(start, candidate)) {
      const promoted = boundaryAfterNode(candidate);
      if (promoted) {
        return { boundary: promoted, changed: true };
      }
    }
  }
  return { boundary: end, changed: false };
}

function normalizeLocatedBoundaries(
  located: Readonly<LocatedRange>,
  root: Element | null,
): LocatedRange {
  if (!root) {
    return located;
  }
  let end: MlgBoundary = { container: located.endContainer, offset: located.endOffset };
  let start: MlgBoundary = { container: located.startContainer, offset: located.startOffset };
  if (start.container?.nodeType === 3 && start.offset === 0) {
    start = boundaryBeforeNode(start.container) ?? start;
  }
  if (
    end.container?.nodeType === 3 &&
    end.offset === (end.container instanceof Text ? end.container.data : "").length
  ) {
    end = boundaryAfterNode(end.container) ?? end;
  }

  let changed = true;
  while (changed) {
    const startResult = promoteStartBoundary(start, end, root);
    start = startResult.boundary;
    const endResult = promoteEndBoundary(end, start, root);
    end = endResult.boundary;
    changed = startResult.changed || endResult.changed;
  }
  return {
    ...located,
    endContainer: end.container,
    endOffset: end.offset,
    startContainer: start.container,
    startOffset: start.offset,
  };
}

export function locateUnitRange(
  stream: TokenStream,
  plainSource: unknown,
  fromIndex = 0,
): LocatedRange | null {
  const source = normalizeUnitText(plainSource);
  if (!source) {
    return null;
  }
  const normalized = normalizeStreamForMatching(stream),
    startIndex = normalized.text.indexOf(source, Math.max(0, fromIndex));
  if (startIndex === -1) {
    return null;
  }
  const endIndex = startIndex + source.length,
    first = normalized.characters[startIndex],
    last = normalized.characters[endIndex - 1];
  if (!first || !last) {
    return null;
  }
  return normalizeLocatedBoundaries(
    {
      endContainer: last.end.container,
      endIndex,
      endOffset: last.end.offset,
      nextIndex: endIndex,
      startContainer: first.start.container,
      startIndex,
      startOffset: first.start.offset,
    },
    stream.blockEl ?? null,
  );
}
