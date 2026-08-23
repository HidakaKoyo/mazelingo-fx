# Upstreamと履歴

```text
Yeq6X/mazelingo
        │ official upstream
        ▼
HidakaKoyo/mazelingo-fx
        ▲ TypeScript + WXT implementation
L4Ph/mazelingo
```

Yeq6Xは機能変更を追従する正式upstream、L4Phは技術的ベース、HidakaKoyo/mazelingo-fxはFirefox対応を保守する派生版です。

## Remoteの期待状態

```text
l4ph     https://github.com/L4Ph/mazelingo.git (fetch/push)
origin   https://github.com/HidakaKoyo/mazelingo-fx.git (fetch/push)
upstream https://github.com/Yeq6X/mazelingo.git (fetch/push)
```

`git remote -v`の表示順は問いません。通常pushするのは`origin`だけです。不足時は次で追加します。

```bash
git remote add upstream https://github.com/Yeq6X/mazelingo.git
git remote add l4ph https://github.com/L4Ph/mazelingo.git
```

## L4Ph版の取り込み

L4Phの`feature/wxt-typescript-migration`にあるcommit `ddd6342`（`ddd63426f9bd191cbc896220945e96dd29adc2c9`）を、Yeq6X upstreamの`6b91045`を指す作業branchへfast-forwardしました。

```text
6b91045  Yeq6X upstream/main
   └── ddd6342  L4Ph feature/wxt-typescript-migration
```

共通祖先上のcommitとしてTypeScript + WXT移行、entrypoint再構成、Vitest / Playwright、lint、CIを履歴ごと取り込めました。merge commit、subtree、file copyを増やさず`git log`と`git blame`で由来を追跡できるため、この方法を採用しました。

## Yeq6X upstream追従手順

WXT移行後はfile構成が異なるため、upstream/mainの機械的mergeが常に正解とは限りません。専用branchで旧JavaScript変更の意図を確認し、現在のTypeScript構成へ移植します。

```bash
git fetch upstream --prune
git switch main
git pull --ff-only origin main
git switch -c chore/sync-upstream-YYYYMMDD
git log --oneline 6b91045..upstream/main
git diff 6b91045..upstream/main -- \
  background.js content_script.js dom-overlay.js llm.js config.js manifest.json
```

`6b91045`はL4Ph WXT移行を取り込んだ時点でのlast-synced Yeq6X SHAです。変更ごとに、意図とtestを確認し、対応する`entrypoints/`または`utils/`へ移植します。upstream commit IDをcommit本文かPRに記録し、typecheck、lint、unit test、Firefox / Chrome buildを実行します。追従が完了したらlast-synced SHAをこの文書で更新し、次回の比較起点にします。

## L4Ph側の更新

L4Phはofficial upstreamではありません。新しいWXT改善も自動mergeせず差分ごとに判断します。

```bash
git fetch l4ph --prune
git log --oneline ddd6342..l4ph/feature/wxt-typescript-migration
git diff ddd6342..l4ph/feature/wxt-typescript-migration
```

採用時はL4Ph commit IDと理由を記録し、Yeq6X由来の機能変更と混同しません。
