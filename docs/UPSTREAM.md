# Upstreamと履歴

Mazelingo-FXは、Yeq6X版を正式なupstream、L4Ph版を技術的な基盤として扱います。

```text
Yeq6X/mazelingo
        │ 正式なupstream
        ▼
HidakaKoyo/mazelingo-fx
        ▲ TypeScriptとWXTの実装
L4Ph/mazelingo
```

Yeq6X版から機能変更を追従し、HidakaKoyo版でFirefox対応を保守します。
L4Ph版は、TypeScriptとWXTへの移行に利用した技術的な基盤です。

## Gitリモートの構成

期待するリモートは、次のとおりです。

```text
l4ph     https://github.com/L4Ph/mazelingo.git (fetch/push)
origin   https://github.com/HidakaKoyo/mazelingo-fx.git (fetch/push)
upstream https://github.com/Yeq6X/mazelingo.git (fetch/push)
```

`git remote -v`における表示順は問いません。
通常は`origin`だけへpushします。
リモートがない場合は、次のコマンドで追加します。

```bash
git remote add upstream https://github.com/Yeq6X/mazelingo.git
git remote add l4ph https://github.com/L4Ph/mazelingo.git
```

## L4Ph版を取り込んだ方法

L4Phの`feature/wxt-typescript-migration`にあるコミット`ddd6342`（`ddd63426f9bd191cbc896220945e96dd29adc2c9`）を、Yeq6X upstreamの`6b91045`を指す作業ブランチへfast-forwardで取り込みました。

```text
6b91045  Yeq6X upstream/main
   └── ddd6342  L4Ph feature/wxt-typescript-migration
```

このコミットには、TypeScriptとWXTへの移行、エントリーポイントの再構成、Vitest、Playwright、lint、CIが含まれます。
共通祖先上のコミットとして取り込むことで、余分なマージコミット、subtree、ファイルの複製を作らず、`git log`と`git blame`から由来を追跡できます。

## Yeq6X版の変更を追従する

WXTへの移行後はファイル構成が異なるため、`upstream/main`をそのままマージできるとは限りません。
専用ブランチで旧JavaScript実装の変更意図を確認し、現在のTypeScript構成へ移植します。

```bash
git fetch upstream --prune
git switch main
git pull --ff-only origin main
git switch -c chore/sync-upstream-YYYYMMDD
git log --oneline 6b91045..upstream/main
git diff 6b91045..upstream/main -- \
  background.js content_script.js dom-overlay.js llm.js config.js manifest.json
```

`6b91045`は、L4Ph版のWXT移行を取り込んだ時点で、最後に同期したYeq6X版のコミットです。
変更ごとに意図とテストを確認し、対応する`entrypoints/`または`utils/`へ移植します。
upstreamのコミットIDはコミット本文かpull requestへ記録します。
移植後は、型検査、lint、単体テスト、FirefoxとChromeのビルドを実行します。
追従が完了したら、この文書にある最終同期コミットを更新し、次回の比較起点にします。

## L4Ph版の更新を確認する

L4Ph版は正式なupstreamではありません。
新しいWXT関連の改善も自動ではマージせず、差分ごとに採用を判断します。

```bash
git fetch l4ph --prune
git log --oneline ddd6342..l4ph/feature/wxt-typescript-migration
git diff ddd6342..l4ph/feature/wxt-typescript-migration
```

採用する場合は、L4Ph版のコミットIDと採用理由を記録します。
Yeq6X版に由来する機能変更とは区別してください。
