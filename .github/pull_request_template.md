## 変更の種類

- [ ] `firefox-only` — FirefoxのUI、manifest、配布、検証
- [ ] `upstreamable` — Yeq6X/mazelingoへ還元できる共通修正
- [ ] `upstream-sync` — Yeq6X/mazelingoの変更を統合
- [ ] `product-policy` — 配布、プライバシー、サポート、運用文書
- [ ] `temporary-divergence` — 上流との一時的な差分

## 概要

<!-- 利用者への影響と、なぜこの変更が必要かを短く説明する。 -->

## 上流との関係

<!-- upstream-sync / upstreamable / temporary-divergenceの場合だけ記入する。該当しなければ N/A。 -->

- Upstream range: `Yeq6X/mazelingo@<before>..<after>`
- Classification: merge / port / not-applicable / deferred
- Upstreamへの還元: PR・Issue・不要と判断した理由
- 同期台帳: `lastMergedCommit` / `lastReviewedCommit` / `lastReviewedAt` / `lastSyncPullRequest` の更新内容

## 検証

- [ ] `npm run compile`
- [ ] `npm run lint`
- [ ] `npm run fmt -- --check`
- [ ] `npm test`
- [ ] `npm run build:firefox`
- [ ] `npm run lint:firefox`
- [ ] `npm run build:chrome`
- [ ] `npm run verify:manifests`
- [ ] Firefox runtime smokeまたは手動確認（変更した場合）

## 送信データ・秘密情報

- [ ] APIキー、認証情報、ページ本文、個人情報を差分・ログ・スクリーンショットへ含めていない
- [ ] 外部送信、host permission、Firefoxデータ収集宣言を変えた場合、manifestとプライバシーポリシーを更新した
