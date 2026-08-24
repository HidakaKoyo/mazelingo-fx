/**
 * Core DOM overlay: tokenizes a leaf block into text/atom tokens, locates a
 * plain-text unit's Range within the live DOM, wraps it in a `.mlg-sentence`
 * span, and re-renders original/translated variants.
 *
 * Implementation is split across focused submodules to keep each file under
 * the line budget; this module re-exports the public surface so external
 * imports (content entrypoint, content-logic, tests) keep working unchanged.
 */

export {
  MLG_ATOM_TAGS,
  MLG_IGNORED_TAGS,
  MLG_PLACEHOLDER_PATTERN,
  boundaryAfterNode,
  boundaryBeforeNode,
  isMlgAtom,
  isMlgIgnoredElement,
  mlgChildNodes,
  mlgTagName,
} from "./dom-overlay-core";
export type { MlgBoundary, MlgNode, MlgSpan, NodeWithMeta } from "./dom-overlay-core";
export {
  buildTokenStream,
  normalizeStreamForMatching,
  normalizeUnitText,
} from "./dom-overlay-tokenize";
export type { CharacterSpan, TokenStream, TokenStreamItem } from "./dom-overlay-tokenize";
export { locateUnitRange } from "./dom-overlay-locate";
export type { LocatedRange } from "./dom-overlay-locate";
export {
  collectAtomElements,
  collectElementTags,
  variantTagSequencesMatch,
  wrapRange,
} from "./dom-overlay-render-util";
export { renderOriginal, renderVariant } from "./dom-overlay-render";
export { structureSignature } from "./dom-overlay-signature";
