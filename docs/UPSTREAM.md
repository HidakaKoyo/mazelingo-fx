# Upstream 同期

Mazelingo-FX の通常 upstream は [`Yeq6X/mazelingo`](https://github.com/Yeq6X/mazelingo) だけです。Firefox Desktop を正式製品として保守し、Chromium は非配布の互換性確認に限定します。運用契約は [ADR 0001](adr/0001-firefox-downstream-contract.md) を参照してください。

## 同期状態

機械可読な正本は [upstream-state.json](upstream-state.json) です。

- last fully integrated: `161132c55646b27560de8a5f2d4f4e4d8eb83e58`
- last reviewed: `161132c55646b27560de8a5f2d4f4e4d8eb83e58`（2026-08-31）

`lastMergedCommit`は、そのcommitまでのupstream変更をすべてMazelingo-FXへ統合した場合だけ進めます。`lastReviewedCommit`は、採用・見送りを判断した範囲まで進めます。両者が異なるときは、未統合または見送りの判断があるため、`lastSyncPullRequest`で示す同期PRを確認してください。

GitHub Actionsの`Upstream watch`は毎週、状態を確認します。未確認の更新を見つけたときだけ`Upstream review: Yeq6X/mazelingo`という単一の追跡Issueを作成または更新し、確認対象がなくなれば閉じます。これは確認の通知と記録のためだけの自動化であり、同期PRやmergeを自動作成しません。

## リモートと push の安全策

必要なリモートは次の2つです。

```text
origin   https://github.com/HidakaKoyo/mazelingo-fx.git
upstream https://github.com/Yeq6X/mazelingo.git
```

`origin` だけが push 先です。clone 後、upstream を read-only に固定します。

```bash
git remote add upstream https://github.com/Yeq6X/mazelingo.git
git remote set-url --push upstream no_push
git config remote.pushDefault origin
```

`no_push` は意図しない upstream への push を失敗させるダミー push URL です。既存 clone でも一度設定し、`git remote -v` で `upstream (push)` が `no_push` であることを確認してください。

## 同期手順

同期は常に専用 branch と pull request で行います。GitHub の fork sync 操作、`main` 上での `git pull upstream main`、自動 merge は使いません。

```bash
git switch main
git pull --ff-only origin main
npm run check:upstream -- --fetch
BASE="$(node -p \"require('./docs/upstream-state.json').upstream.lastMergedCommit\")"
git switch -c sync/yeq6x-YYYYMMDD
git log --oneline "$BASE..upstream/main"
git diff --stat "$BASE..upstream/main"
```

### clean merge できる場合

upstream の履歴を保持します。

```bash
git merge --no-ff upstream/main
```

競合を解消したら、Firefox と Chromium の build、manifest 検証、lint、単体テストを実行して PR を作成します。

### Firefox 固有構造と衝突する場合

機械的な競合解消で意図を失わないよう、merge を中止します。

```bash
git merge --abort
```

必要な upstream commit を `cherry-pick -x` するか、変更意図を Firefox 側の構造へ移植します。対象 commit、採用・見送りの理由、適応箇所を PR に記録してください。sync PRをmergeした後、判断した範囲まで`lastReviewedCommit`と`lastReviewedAt`を更新します。`lastMergedCommit`は、そこまでのupstream変更をすべて統合できた場合だけ更新します。

## 同期 PR の記録

同期 PR には必ず次を含めます。

- 比較した upstream commit 範囲
- merge、cherry-pick、意味移植、見送りの別
- 各見送りの理由
- Firefox 固有の適応箇所
- 実行した検証と未実施の確認
- 更新した`lastMergedCommit`、`lastReviewedCommit`、`lastReviewedAt`
- 一部を見送った場合は、見送ったcommitと理由、および`lastSyncPullRequest`

browser 共通の修正は upstream への提案を優先し、Mazelingo-FX だけに残す場合は理由を同じ PR に記録します。
