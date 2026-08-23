# 0001: L4PhのWXT移行を技術的なベースに使う

## Context

Yeq6X/mazelingoは正式upstreamだが、Firefoxを継続保守するにはbrowser別build、TypeScript、test可能なmodule分割が必要だった。L4Phの`feature/wxt-typescript-migration`は同じupstream履歴上でTypeScript + WXT、entrypoint再構成、Vitest / Playwright、lint、CIを実装していた。

## Decision

Yeq6X upstreamの`6b91045`から作業branchを作り、L4Phのcommit `ddd6342`をfast-forwardする。official upstreamはYeq6X、L4Phは別remoteとして保持する。

## Reason

共通祖先上のcommitとして取り込めるため、file copyより由来を追跡しやすい。WXTのmulti-browser buildとtestをFirefox移植へ再利用できる。

## Consequences

- L4Ph由来をREADME、UPSTREAM.md、Git履歴に残す
- Yeq6Xの変更は現在のTypeScript構成へ判断して移植する
- L4Phの将来変更は自動upstream扱いせず差分ごとに採否を決める
- WXT移行由来の不具合もMazelingo-FXで保守する
