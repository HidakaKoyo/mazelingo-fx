// DOM-preserving translation overlay: wraps translation units on the original
// text-node stream and swaps variants in place, keeping element structure intact.
// Content scripts of one extension share a global scope, so everything is kept
// inside an IIFE and exposed through globalThis.MazelingoDomOverlay at the end.
(() => {
const MLG_ATOM_TAGS = new Set([
  "svg", "img", "video", "canvas", "input", "select", "textarea", "iframe",
]);
const MLG_IGNORED_TAGS = new Set(["script", "style", "noscript", "template"]);
const MLG_PLACEHOLDER_PATTERN = /⟦(\d+)⟧/g;

function mlgTagName(node) {
  return typeof node?.tagName === "string" ? node.tagName.toLowerCase() : "";
}

function isMlgIgnoredElement(element) {
  return element?.nodeType === 1 && (
    MLG_IGNORED_TAGS.has(mlgTagName(element)) || element.getAttribute?.("aria-hidden") === "true"
  );
}

function isMlgAtom(element) {
  if (element?.nodeType !== 1) return false;
  if (typeof element.__mlgIsAtom === "boolean") return element.__mlgIsAtom;
  return MLG_ATOM_TAGS.has(mlgTagName(element)) || String(element.textContent || "").trim() === "";
}

function mlgChildNodes(node) {
  return Array.from(node?.childNodes || []);
}

function buildTokenStream(blockEl, isMlgNode = () => false) {
  const stream = [];
  stream.blockEl = blockEl;
  let atomNumber = 0;

  function visit(node) {
    if (!node) return;
    if (node.nodeType === 3) {
      if (node.data) stream.push({ type: "text", node, text: node.data });
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 11 && node.nodeType !== 9) return;
    if (node.nodeType === 1) {
      if (isMlgIgnoredElement(node)) return;
      if (isMlgNode(node)) {
        mlgChildNodes(node).forEach(visit);
        return;
      }
      const atom = MLG_ATOM_TAGS.has(mlgTagName(node)) || String(node.textContent || "").trim() === "";
      node.__mlgIsAtom = atom;
      if (atom) {
        atomNumber += 1;
        node.__mlgAtomNumber = atomNumber;
        stream.push({
          type: "atom",
          node,
          atomNumber,
          text: `⟦${atomNumber}⟧`,
        });
        return;
      }
    }
    mlgChildNodes(node).forEach(visit);
  }

  mlgChildNodes(blockEl).forEach(visit);
  return stream;
}

function boundaryBeforeNode(node) {
  const parent = node?.parentNode;
  if (!parent) return null;
  const offset = mlgChildNodes(parent).indexOf(node);
  return offset < 0 ? null : { container: parent, offset };
}

function boundaryAfterNode(node) {
  const before = boundaryBeforeNode(node);
  return before ? { container: before.container, offset: before.offset + 1 } : null;
}

function normalizeStreamForMatching(stream) {
  const characters = [];
  let pendingWhitespace = null;

  function pushCharacter(value, start, end) {
    if (/\s/.test(value)) {
      if (!pendingWhitespace) pendingWhitespace = { start, end };
      else pendingWhitespace.end = end;
      return;
    }
    if (pendingWhitespace) {
      characters.push({ value: " ", ...pendingWhitespace });
      pendingWhitespace = null;
    }
    characters.push({ value, start, end });
  }

  stream.forEach((token) => {
    if (token.type === "atom") {
      const start = boundaryBeforeNode(token.node);
      const end = boundaryAfterNode(token.node);
      if (!start || !end) return;
      Array.from(token.text).forEach((value) => pushCharacter(value, start, end));
      return;
    }
    const text = typeof token.text === "string" ? token.text : String(token.node?.data || "");
    for (let offset = 0; offset < text.length; offset += 1) {
      pushCharacter(
        text[offset],
        { container: token.node, offset },
        { container: token.node, offset: offset + 1 }
      );
    }
  });
  if (pendingWhitespace) characters.push({ value: " ", ...pendingWhitespace });
  return {
    text: characters.map((character) => character.value).join(""),
    characters,
  };
}

function normalizeUnitText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function nodeIndex(node) {
  return mlgChildNodes(node?.parentNode).indexOf(node);
}

function boundaryInsideElement(boundary, element) {
  let node = boundary?.container;
  while (node) {
    if (node === element) return true;
    node = node.parentNode;
  }
  return false;
}

function boundaryAtElementStart(boundary, element) {
  let container = boundary?.container;
  let offset = boundary?.offset;
  while (container && container !== element) {
    if (container.nodeType === 3) {
      if (offset !== 0) return false;
    } else if (offset !== 0) {
      return false;
    }
    const parent = container.parentNode;
    if (!parent || nodeIndex(container) !== 0) return false;
    container = parent;
    offset = 0;
  }
  return container === element && offset === 0;
}

function boundaryAtElementEnd(boundary, element) {
  let container = boundary?.container;
  let offset = boundary?.offset;
  while (container && container !== element) {
    const length = container.nodeType === 3
      ? String(container.data || "").length
      : mlgChildNodes(container).length;
    if (offset !== length) return false;
    const parent = container.parentNode;
    if (!parent || nodeIndex(container) !== mlgChildNodes(parent).length - 1) return false;
    container = parent;
    offset = mlgChildNodes(container).length;
  }
  return container === element && offset === mlgChildNodes(element).length;
}

function normalizeLocatedBoundaries(located, root) {
  if (!root) return located;
  let start = { container: located.startContainer, offset: located.startOffset };
  let end = { container: located.endContainer, offset: located.endOffset };
  if (start.container?.nodeType === 3 && start.offset === 0) {
    start = boundaryBeforeNode(start.container) || start;
  }
  if (
    end.container?.nodeType === 3 &&
    end.offset === String(end.container.data || "").length
  ) {
    end = boundaryAfterNode(end.container) || end;
  }

  let changed = true;
  while (changed) {
    changed = false;
    if (start.container && start.container !== root && start.container.nodeType === 1 && start.offset === 0) {
      const candidate = start.container;
      if (!boundaryInsideElement(end, candidate) || boundaryAtElementEnd(end, candidate)) {
        const promoted = boundaryBeforeNode(candidate);
        if (promoted) {
          start = promoted;
          changed = true;
        }
      }
    }
    if (
      end.container &&
      end.container !== root &&
      end.container.nodeType === 1 &&
      end.offset === mlgChildNodes(end.container).length
    ) {
      const candidate = end.container;
      if (!boundaryInsideElement(start, candidate) || boundaryAtElementStart(start, candidate)) {
        const promoted = boundaryAfterNode(candidate);
        if (promoted) {
          end = promoted;
          changed = true;
        }
      }
    }
  }
  return {
    ...located,
    startContainer: start.container,
    startOffset: start.offset,
    endContainer: end.container,
    endOffset: end.offset,
  };
}

function locateUnitRange(stream, plainSource, fromIndex = 0) {
  const source = normalizeUnitText(plainSource);
  if (!source) return null;
  const normalized = normalizeStreamForMatching(stream);
  const startIndex = normalized.text.indexOf(source, Math.max(0, Number(fromIndex) || 0));
  if (startIndex < 0) return null;
  const endIndex = startIndex + source.length;
  const first = normalized.characters[startIndex];
  const last = normalized.characters[endIndex - 1];
  if (!first || !last) return null;
  return normalizeLocatedBoundaries({
    startContainer: first.start.container,
    startOffset: first.start.offset,
    endContainer: last.end.container,
    endOffset: last.end.offset,
    startIndex,
    endIndex,
    nextIndex: endIndex,
  }, stream.blockEl);
}

function ownerDocumentFor(node) {
  if (node?.nodeType === 9) return node;
  return node?.ownerDocument || null;
}

function cloneChildFragment(node) {
  const documentRef = ownerDocumentFor(node);
  if (!documentRef) throw new Error("[mlg:overlay] ownerDocument is required");
  const fragment = documentRef.createDocumentFragment();
  mlgChildNodes(node).forEach((child) => {
    const clone = child.cloneNode(true);
    copyMlgNodeMetadata(child, clone);
    fragment.appendChild(clone);
  });
  return fragment;
}

function copyMlgNodeMetadata(source, clone) {
  if (typeof source?.__mlgIsAtom === "boolean") clone.__mlgIsAtom = source.__mlgIsAtom;
  const sourceChildren = mlgChildNodes(source);
  const cloneChildren = mlgChildNodes(clone);
  sourceChildren.forEach((child, index) => copyMlgNodeMetadata(child, cloneChildren[index]));
}

function cloneFragmentWithMetadata(fragment) {
  const clone = fragment.cloneNode(true);
  copyMlgNodeMetadata(fragment, clone);
  return clone;
}

function collectAtomElements(root) {
  const atoms = [];
  function visit(node) {
    if (node?.nodeType === 1 && isMlgAtom(node)) {
      atoms.push(node);
      return;
    }
    mlgChildNodes(node).forEach(visit);
  }
  mlgChildNodes(root).forEach(visit);
  return atoms;
}

function wrapRange(range) {
  const documentRef = ownerDocumentFor(range?.startContainer);
  if (!documentRef || typeof range.extractContents !== "function") {
    throw new TypeError("[mlg:overlay] wrapRange requires a DOM Range");
  }
  const extracted = range.extractContents();
  const span = documentRef.createElement("span");
  span.className = "mlg-sentence";
  span.appendChild(extracted);
  span.__mlgAtoms = new Map();
  span.__mlgAtomNumbers = [];
  collectAtomElements(span).forEach((atom) => {
    const number = Number(atom.__mlgAtomNumber);
    if (!Number.isInteger(number) || number < 1) return;
    span.__mlgAtoms.set(number, atom);
    span.__mlgAtomNumbers.push(number);
  });
  span.__mlgOriginal = cloneChildFragment(span);
  range.insertNode(span);
  return span;
}

function collectElementTags(root) {
  const tags = [];
  function visit(node) {
    if (node?.nodeType === 1) {
      if (isMlgAtom(node)) return;
      tags.push(mlgTagName(node));
    }
    mlgChildNodes(node).forEach(visit);
  }
  mlgChildNodes(root).forEach(visit);
  return tags;
}

function variantTagSequencesMatch(originalRoot, variantRoot) {
  const originalTags = collectElementTags(originalRoot);
  const variantTags = collectElementTags(variantRoot);
  return originalTags.length === variantTags.length && originalTags.every(
    (tagName, index) => tagName === variantTags[index]
  );
}

function parseVariantFragment(documentRef, html) {
  const template = documentRef.createElement("template");
  template.innerHTML = typeof html === "string" ? html : "";
  return template.content.cloneNode(true);
}

function buildElementIndex(root) {
  const elements = [];
  function visit(node) {
    if (node?.nodeType === 1) {
      if (isMlgAtom(node)) return;
      elements.push(node);
    }
    mlgChildNodes(node).forEach(visit);
  }
  mlgChildNodes(root).forEach(visit);
  return elements;
}

function hydrateOriginalAtoms(fragment, span, atoms) {
  const clones = collectAtomElements(fragment);
  const numbers = Array.isArray(span.__mlgAtomNumbers) ? span.__mlgAtomNumbers : [];
  clones.forEach((clone, index) => {
    const number = numbers[index];
    const actual = atoms?.get?.(number) || span.__mlgAtoms?.get?.(number);
    if (actual) clone.replaceWith(actual);
  });
  return fragment;
}

function removeTextNodes(root) {
  const textNodes = [];
  function visit(node) {
    mlgChildNodes(node).forEach((child) => {
      if (child.nodeType === 3) textNodes.push(child);
      else if (child.nodeType === 1 || child.nodeType === 11) visit(child);
    });
  }
  visit(root);
  textNodes.forEach((node) => node.remove());
}

function appendTextWithAtoms(documentRef, target, before, text, atoms, usedAtoms) {
  const fragment = documentRef.createDocumentFragment();
  let cursor = 0;
  MLG_PLACEHOLDER_PATTERN.lastIndex = 0;
  let match;
  while ((match = MLG_PLACEHOLDER_PATTERN.exec(text)) !== null) {
    if (match.index > cursor) fragment.appendChild(documentRef.createTextNode(text.slice(cursor, match.index)));
    const number = Number(match[1]);
    const atom = atoms?.get?.(number);
    if (atom) {
      fragment.appendChild(atom);
      usedAtoms.add(number);
    } else {
      fragment.appendChild(documentRef.createTextNode(match[0]));
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) fragment.appendChild(documentRef.createTextNode(text.slice(cursor)));
  target.insertBefore(fragment, before || null);
}

function renderMatchingVariant(original, variant, span, atoms) {
  const documentRef = ownerDocumentFor(span);
  const originalElements = buildElementIndex(original);
  const variantElements = buildElementIndex(variant);
  const variantElementIndexes = new Map(variantElements.map((element, index) => [element, index]));
  const usedAtoms = new Set();
  const textPlacements = [];

  function collectTextPlacements(node) {
    mlgChildNodes(node).forEach((child) => {
      if (child.nodeType === 3) {
        textPlacements.push(child);
      } else if (child.nodeType === 1 && !isMlgAtom(child)) {
        collectTextPlacements(child);
      }
    });
  }
  collectTextPlacements(variant);
  removeTextNodes(original);

  textPlacements.forEach((textNode) => {
    const variantParent = textNode.parentNode;
    const parentIndex = variantElementIndexes.get(variantParent);
    const targetParent = parentIndex === undefined ? original : originalElements[parentIndex];
    if (!targetParent) return;
    let nextElement = textNode.nextSibling;
    while (nextElement && (nextElement.nodeType !== 1 || isMlgAtom(nextElement))) {
      nextElement = nextElement.nextSibling;
    }
    const nextIndex = variantElementIndexes.get(nextElement);
    const targetBefore = nextIndex === undefined ? null : originalElements[nextIndex];
    appendTextWithAtoms(
      documentRef,
      targetParent,
      targetBefore?.parentNode === targetParent ? targetBefore : null,
      textNode.data,
      atoms,
      usedAtoms
    );
  });
}

function renderFallbackVariant(original, variant, span, atoms) {
  const documentRef = ownerDocumentFor(span);
  let firstText = null;
  function findFirstText(node) {
    for (const child of mlgChildNodes(node)) {
      if (child.nodeType === 3) return child;
      if (child.nodeType === 1 && !isMlgAtom(child)) {
        const nested = findFirstText(child);
        if (nested) return nested;
      }
    }
    return null;
  }
  firstText = findFirstText(original);
  const targetParent = firstText?.parentNode || original;
  const targetBefore = firstText?.nextSibling || null;
  const ownedNumbers = Array.isArray(span.__mlgAtomNumbers) ? span.__mlgAtomNumbers : [];
  const ownedAtoms = ownedNumbers.map((number) => [number, atoms?.get?.(number)]).filter((entry) => entry[1]);
  removeTextNodes(original);
  ownedAtoms.forEach(([, atom]) => atom.remove());
  const usedAtoms = new Set();
  appendTextWithAtoms(
    documentRef,
    targetParent,
    targetBefore?.parentNode === targetParent ? targetBefore : null,
    String(variant.textContent || ""),
    atoms,
    usedAtoms
  );
  ownedAtoms.forEach(([number, atom]) => {
    if (!usedAtoms.has(number)) targetParent.appendChild(atom);
  });
}

function renderVariant(span, variantHtml, atoms) {
  const documentRef = ownerDocumentFor(span);
  if (!documentRef || !span.__mlgOriginal) {
    throw new Error("[mlg:overlay] renderVariant requires a wrapped span");
  }
  const atomMap = atoms || span.__mlgAtoms || new Map();
  const original = hydrateOriginalAtoms(cloneFragmentWithMetadata(span.__mlgOriginal), span, atomMap);
  const variant = parseVariantFragment(documentRef, variantHtml);
  if (variantTagSequencesMatch(original, variant)) {
    renderMatchingVariant(original, variant, span, atomMap);
  } else {
    renderFallbackVariant(original, variant, span, atomMap);
  }
  span.replaceChildren(original);
}

function renderOriginal(span) {
  if (!span?.__mlgOriginal) throw new Error("[mlg:overlay] renderOriginal requires a wrapped span");
  const original = hydrateOriginalAtoms(
    cloneFragmentWithMetadata(span.__mlgOriginal),
    span,
    span.__mlgAtoms || new Map()
  );
  span.replaceChildren(original);
}

function structureSignature(el, { ignoreMlg = true } = {}) {
  const signature = [];
  function visit(node) {
    if (node?.nodeType !== 1) return;
    const isWrapper = ignoreMlg && (
      node.dataset?.mlgSentence === "1" || node.classList?.contains?.("mlg-sentence")
    );
    if (isWrapper) {
      mlgChildNodes(node).forEach(visit);
      return;
    }
    const attributes = Array.from(node.attributes || [])
      .filter((attribute) => !ignoreMlg || !attribute.name.toLowerCase().startsWith("data-mlg-"))
      .map((attribute) => `${attribute.name.toLowerCase()}=${attribute.value}`)
      .sort();
    signature.push([mlgTagName(node), attributes, isMlgAtom(node)]);
    mlgChildNodes(node).forEach(visit);
  }
  visit(el);
  return signature;
}

if (globalThis.__MLG_TEST__) {
  globalThis.__mlgOverlayPure = {
    normalizeUnitText,
    normalizeStreamForMatching,
    locateUnitRange,
    collectElementTags,
    variantTagSequencesMatch,
    structureSignature,
  };
}

globalThis.MazelingoDomOverlay = Object.freeze({
  isMlgIgnoredElement,
  isMlgAtom,
  buildTokenStream,
  locateUnitRange,
  wrapRange,
  renderVariant,
  renderOriginal,
  structureSignature,
});
})();
