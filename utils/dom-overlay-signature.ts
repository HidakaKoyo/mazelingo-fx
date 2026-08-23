import { isMlgAtom, mlgChildNodes, mlgTagName } from "./dom-overlay-core";
import type { MlgNode } from "./dom-overlay-core";

export function structureSignature(
  el: Element,
  opts: Readonly<{ ignoreMlg?: boolean }> = {},
): [string, string[], boolean][] {
  const ignoreMlg = opts.ignoreMlg ?? true,
    signature: [string, string[], boolean][] = [];
  function visit(node: MlgNode): void {
    if (node?.nodeType !== 1) {
      return;
    }
    let isWrapper = false;
    if (ignoreMlg && node instanceof Element) {
      const viaDataset = node instanceof HTMLElement && node.dataset?.mlgSentence === "1";
      const viaClass = node.classList.contains("mlg-sentence");
      isWrapper = viaDataset || viaClass;
    }
    if (isWrapper) {
      mlgChildNodes(node).forEach((child) => {
        visit(child);
      });
      return;
    }
    const attributes = (node instanceof Element ? [...node.attributes] : [])
      .filter((attribute) => !ignoreMlg || !attribute.name.toLowerCase().startsWith("data-mlg-"))
      .map((attribute) => `${attribute.name.toLowerCase()}=${attribute.value}`)
      .toSorted();
    signature.push([mlgTagName(node), attributes, isMlgAtom(node)]);
    mlgChildNodes(node).forEach((child) => {
      visit(child);
    });
  }
  visit(el);
  return signature;
}
