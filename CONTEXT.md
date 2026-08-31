# Mazelingo-FX の運用コンテキスト

Mazelingo-FX は、Web ページを文単位で翻訳表示する Firefox 拡張です。

## 製品の範囲

- **正式製品**: Firefox Desktop 140 以降向けの拡張、署名済み XPI、Firefox 利用者へのサポート
- **通常 upstream**: [`Yeq6X/mazelingo`](https://github.com/Yeq6X/mazelingo)
- **Chromium**: upstream との統合を継続可能にするための build / manifest 互換性確認。Mazelingo-FX として配布・サポートしない

Firefox 固有の実装は browser abstraction、Firefox manifest、Sidebar、AMO 配布、Firefox 検証に閉じ込めます。ブラウザ共通の機能修正は、可能なら upstream へ提案します。

## 作業を始める前に読むもの

1. [CONTRIBUTING.md](CONTRIBUTING.md): 開発・PR・upstream 同期の手順
2. [docs/adr/0001-firefox-downstream-contract.md](docs/adr/0001-firefox-downstream-contract.md): この fork の責務と非目標
3. [docs/UPSTREAM.md](docs/UPSTREAM.md): 現在の同期基点と同期記録
4. [docs/TESTING.md](docs/TESTING.md): 検証の範囲
5. [docs/RELEASING.md](docs/RELEASING.md): Firefox リリースの手順

## 開発上の原則

- `main` は公開済みの統合履歴であり、rebase / force-push しない。
- 通常の変更は小さな feature / fix branch で行い、PR を通して squash merge する。
- upstream 同期は専用の `sync/yeq6x-YYYYMMDD` branch で行い、同期 PR と記録を必ず残す。
- Chromium の build 成功は、Chromium を正式サポートする意味ではない。
- API キーや利用者データを source、issue、PR、CI ログへ入れない。

この契約を変える変更は、ADR と公開ドキュメントを同じ PR で更新します。
