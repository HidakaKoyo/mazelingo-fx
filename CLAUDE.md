# Mazelingo-FX 開発ガイド

Mazelingo-FXは、Firefox Desktop向けに配布・動作保証・サポートを行うManifest V3拡張です。
正式なupstreamは[**Yeq6X/mazelingo**](https://github.com/Yeq6X/mazelingo)だけです。Chrome/Chromium向けコードは、上流追従を容易にするための互換性確認として残しますが、Mazelingo-FXとして配布・サポートしません。

このファイルは開発時の要点です。初めて参加する場合は、[CONTRIBUTING.md](CONTRIBUTING.md)、[Upstream運用](docs/UPSTREAM.md)、[テスト](docs/TESTING.md)も先に読んでください。

## 開発と確認

```bash
npm ci
npm run dev:firefox
npm run dev:firefox:lab
npm run compile
npm run lint
npm run fmt -- --check
npm test
npm run build:firefox
npm run lint:firefox
npm run build:chrome
npm run verify:manifests
```

- `npm run dev:firefox:lab`は実ページを使うdogfooding専用です。APIキーや閲覧内容をログ、Issue、PR、テスト成果物へ出しません。
- `npm run test:e2e`は現在Chromium互換性の診断です。Firefoxの正式リリース根拠にはしません。
- APIキーはソース、`.env`、Issue、PR、CIログへ保存・転載しません。

## ブラウザ境界

- Firefox固有のmanifest設定は`wxt.config.ts`に置く
- パネルを開くブラウザAPIの差分は`utils/browser-actions.ts`に置く
- 共通の翻訳・保存・LLM処理へブラウザ判定を散在させない
- Firefox MV3のbackgroundは`background.scripts`、Chromeのbackgroundはservice workerである。片方へ寄せない

## Gitと上流追従

- `main`はFirefox release candidateであり、rebaseやforce pushをしない
- 通常の変更は`feat/*`または`fix/*`からPRを作る
- 上流同期は`sync/yeq6x-YYYYMMDD`だけで行い、upstream由来を残すmerge commitを使う
- `main`上で`git pull upstream main`やGitHubのFork同期を実行しない
- browser-neutralな修正は、upstreamへ還元できるかをPR本文で判断する
- `origin`だけへpushする。`upstream`へのpushは許可しない

## 変更時の確認

- Firefoxの送信データ、host permission、manifestを変えたら、`docs/privacy-policy.md`とFirefoxのデータ収集宣言を同時に見直す
- Firefox APIを変えたら、生成manifest、Firefox package検査、Firefox runtime smoke、手動release acceptanceの対象を更新する
- Chromiumのbuild成功は利用者サポートの保証ではない。互換性確認として扱う
