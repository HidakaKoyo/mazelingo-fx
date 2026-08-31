# Contributing to Mazelingo-FX

Mazelingo-FX は Firefox Desktop を正式製品として保守する downstream です。開発方針は [CONTEXT.md](CONTEXT.md)、設計上の責務は [Firefox downstream contract](docs/adr/0001-firefox-downstream-contract.md) を参照してください。

## 開発環境

Node.js 22.18 以降と npm を使います。

```bash
npm ci
npm run compile
npm run lint
npm run fmt -- --check
npm test
npm run build:firefox
npm run lint:firefox
npm run build:chrome
npm run verify:manifests
```

Firefox で確認するときは `npm run dev:firefox` を使います。検証対象と、静的検証では代替できない確認は [docs/TESTING.md](docs/TESTING.md) に従います。

## 通常の変更

1. `main` を更新して `feat/<topic>` または `fix/<topic>` branch を作る。
2. 目的に必要な最小変更とテストを加える。
3. Firefox 固有か browser 共通かを PR に明記する。
4. 必要な検証を実行し、未実施の実機確認は未実施と記録する。
5. CI が通った PR を squash merge する。

Firefox 固有の差分は、browser abstraction、Firefox manifest、Sidebar、配布・検証設定へ局所化してください。browser 共通の不具合や機能は upstream への提案を検討し、Mazelingo-FX にだけ残す理由を PR に記録します。

## Yeq6X upstream の同期

同期は [docs/UPSTREAM.md](docs/UPSTREAM.md) の手順だけを使います。要点は次のとおりです。

- `main` で直接 merge しない。`sync/yeq6x-YYYYMMDD` branch を作る。
- clean merge できる更新は merge commit を保持する。
- Firefox 固有構造との衝突でそのまま merge できない場合は、merge を中止して必要な upstream commit を `cherry-pick -x` または意味移植する。
- 同期 PR に、比較範囲、採用・見送り、Firefox 適応、検証結果を残す。
- 同期完了後に [docs/upstream-state.json](docs/upstream-state.json) と [docs/UPSTREAM.md](docs/UPSTREAM.md) を更新する。`lastMergedCommit`は完全統合時だけ、`lastReviewedCommit`は採用・見送りを判断した範囲まで進める。

GitHub の fork sync 操作や `main` への直接 pull は使いません。これは downstream 固有の Firefox 差分をレビューなしに取り込まないためです。

## pull request に含めること

- 変更の目的と利用者への影響
- Firefox 固有差分か、browser 共通差分か
- 実行した検証と結果
- upstream 由来なら、upstream repository / commit と採用・見送りの理由
- UI、権限、送信データ、依存関係、配布手順を変える場合は、その影響

脆弱性や API キーを issue / PR で公開しないでください。報告先は [SUPPORT.md](SUPPORT.md) を参照してください。
