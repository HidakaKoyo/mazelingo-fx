# Support

## サポート対象

Mazelingo-FX は Firefox Desktop 140 以降を正式サポートします。Firefox 向けの署名済みリリースだけが、Mazelingo-FX の配布物です。

Chromium 向け build と manifest の確認は upstream 統合作業のために維持しますが、Mazelingo-FX として Chromium 版を配布・サポートしません。

## 問題の報告

公開してよい再現情報は GitHub Issues で報告してください。次を含めると調査しやすくなります。

- Mazelingo-FX のバージョン
- Firefox のバージョンと OS
- 再現手順、期待結果、実際の結果
- 関係する設定（API キー、本文、URL のクエリや認証情報は除く）

拡張のセキュリティ問題、API キー、個人情報、非公開ページの内容は issue に投稿しないでください。[SECURITY.md](SECURITY.md) の非公開報告手順を使ってください。

## upstream 由来の問題

Mazelingo-FX 固有の Firefox 実装・配布・設定以外の問題は、[`Yeq6X/mazelingo`](https://github.com/Yeq6X/mazelingo) でも再現するかを確認します。upstream でも再現する場合は upstream への報告または修正提案を優先し、Mazelingo-FX 側の追跡 issue には upstream へのリンクを残します。
