import {
  MLG_ATOM_TAGS,
  boundaryAfterNode,
  boundaryBeforeNode,
  isMlgIgnoredElement,
  mlgChildNodes,
  mlgTagName,
} from "./dom-overlay-core";
import type { MlgBoundary, NodeWithMeta } from "./dom-overlay-core";

export interface TokenStreamItem {
  type: "text" | "atom";
  node: Node;
  text: string;
  atomNumber?: number;
}

export type TokenStream = TokenStreamItem[] & { blockEl?: Element | null };

interface TokenBuildState {
  stream: TokenStreamItem[];
  atomNumber: number;
  isMlgNode: (n: Node) => boolean;
}

function visitNode(node: Node | null | undefined, state: TokenBuildState): void {
  if (!node) {
    return;
  }
  if (node instanceof Text) {
    if (node.data) {
      state.stream.push({ type: "text", node, text: node.data });
    }
    return;
  }
  if (node.nodeType !== 1 && node.nodeType !== 11 && node.nodeType !== 9) {
    return;
  }
  if (node.nodeType === 1) {
    if (isMlgIgnoredElement(node)) {
      return;
    }
    if (state.isMlgNode(node)) {
      mlgChildNodes(node).forEach((child) => {
        visitNode(child, state);
      });
      return;
    }
    const isAtom =
      MLG_ATOM_TAGS.has(mlgTagName(node)) ||
      (node instanceof Element && (node.textContent ?? "").trim() === "");
    (node as NodeWithMeta).mlgIsAtom = isAtom;
    if (isAtom) {
      state.atomNumber += 1;
      (node as NodeWithMeta).mlgAtomNumber = state.atomNumber;
      state.stream.push({
        atomNumber: state.atomNumber,
        node,
        text: `⟦${state.atomNumber}⟧`,
        type: "atom",
      });
      return;
    }
  }
  mlgChildNodes(node).forEach((child) => {
    visitNode(child, state);
  });
}

export function buildTokenStream(
  blockEl: Element,
  isMlgNode: (n: Node) => boolean = () => false,
): TokenStream {
  const state: TokenBuildState = { stream: [], atomNumber: 0, isMlgNode };
  (state.stream as TokenStream).blockEl = blockEl;
  mlgChildNodes(blockEl).forEach((child) => {
    visitNode(child, state);
  });
  return state.stream;
}

export interface CharacterSpan {
  value: string;
  start: MlgBoundary;
  end: MlgBoundary;
}

interface MatchingState {
  characters: CharacterSpan[];
  pendingWhitespace: { start: MlgBoundary; end: MlgBoundary } | null;
}

function pushMatchingCharacter(
  state: MatchingState,
  value: string,
  start: MlgBoundary,
  end: MlgBoundary,
): void {
  if (/\s/u.test(value)) {
    if (state.pendingWhitespace) {
      state.pendingWhitespace.end = end;
    } else {
      state.pendingWhitespace = { start, end };
    }
    return;
  }
  if (state.pendingWhitespace) {
    state.characters.push({
      end: state.pendingWhitespace.end,
      start: state.pendingWhitespace.start,
      value: " ",
    });
    state.pendingWhitespace = null;
  }
  state.characters.push({ end, start, value });
}

function pushStreamCharacter(
  token: TokenStreamItem,
  pushCharacter: (value: string, start: MlgBoundary, end: MlgBoundary) => void,
): void {
  if (token.type === "atom") {
    const end = boundaryAfterNode(token.node),
      start = boundaryBeforeNode(token.node);
    if (!start || !end) {
      return;
    }
    for (let offset = 0; offset < token.text.length; offset += 1) {
      const character = token.text[offset];
      if (character === undefined) {
        break;
      }
      pushCharacter(character, start, end);
    }
    return;
  }
  const text =
    typeof token.text === "string" ? token.text : token.node instanceof Text ? token.node.data : "";
  for (let offset = 0; offset < text.length; offset += 1) {
    const character = text[offset];
    if (character === undefined) {
      break;
    }
    pushCharacter(
      character,
      { container: token.node, offset },
      { container: token.node, offset: offset + 1 },
    );
  }
}

export function normalizeStreamForMatching(stream: TokenStream): {
  text: string;
  characters: CharacterSpan[];
} {
  const state: MatchingState = { characters: [], pendingWhitespace: null };
  stream.forEach((token) => {
    pushStreamCharacter(token, (value, start, end) => {
      pushMatchingCharacter(state, value, start, end);
    });
  });
  if (state.pendingWhitespace) {
    state.characters.push({
      value: " ",
      start: state.pendingWhitespace.start,
      end: state.pendingWhitespace.end,
    });
  }
  return {
    characters: state.characters,
    text: state.characters.map((character) => character.value).join(""),
  };
}

export function normalizeUnitText(value: unknown): string {
  const text = typeof value === "string" ? value : "";
  return text.replaceAll(/\s+/gu, " ").trim();
}
