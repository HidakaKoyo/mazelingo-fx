# 0003: ブラウザ差分を小さなadapterへ隔離する

## Context

翻訳、DOM、storage、cache、UIの大半はFirefoxとChromeで共通だが、panel APIとmanifest keyは互換ではない。共通coreへbrowser判定を散在させると保守範囲が増える。

## Decision

runtime APIは`wxt/browser`へ統一し、panelを開く操作を小さなbrowser adapterへ閉じ込める。manifest差分はWXT configのtarget判定に置く。DOM、LLM、cache、storage schemaにはbrowser固有分岐を持ち込まない。

## Reason

差分が存在する境界だけを抽象化すれば、不要なframeworkを作らず共通coreをtestでき、API変更時の修正箇所も限定できる。

## Consequences

- 新しいbrowser固有APIはadapterへ収められるか先に検討する
- target判定をmanifest生成とadapter選択以外へ広げない
- adapter unit test、生成manifest、実browserをそれぞれ確認する
- UX差は無理に同一化せずFIREFOX_PORT.mdへ記録する
