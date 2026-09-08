# Firefox Add-ons 初回登録資料

対象バージョン: 0.5.0。配布先はFirefox Add-onsの公開掲載（listed）。
この文書は提出用の原稿であり、提出・審査・公開の完了記録ではありません。

## 掲載情報

- 名前: Mazelingo-FX
- 希望スラッグ: mazelingo-fx（利用可能かは登録画面で確認）
- 概要: Webページを文単位で翻訳し、原文と訳文を混ぜて読める語学学習向けFirefox拡張です。利用者自身のAIプロバイダーのAPIキーが必要です。
- カテゴリ候補: 言語サポート、生産性（登録画面の選択肢に合わせる）
- 対象: Firefox Desktop 140以降。Androidは対象外
- ライセンス: MIT
- ホームページ: https://github.com/HidakaKoyo/mazelingo-fx
- サポート: https://github.com/HidakaKoyo/mazelingo-fx/issues
- 有料サービス等の利用: あり。外部AIプロバイダーの利用料金が発生する場合があります
- プライバシーポリシー: docs/privacy-policy.md の本文

## 説明

Mazelingo-FXは、Webページの文章を文単位で翻訳し、原文と訳文を混ぜて表示するFirefox拡張です。普段のWeb閲覧を語学学習に利用できます。

- 翻訳文と原文の切り替え、対訳の表示
- 文法解説、語彙の保存、学習機能
- Firefox Sidebarから言語、モデル、対象サイトを設定
- OpenAI、Anthropic、Google Gemini、OpenRouterなどの対応AIプロバイダーを利用
- 音声読み上げはOpenAIのAPIを利用

利用者自身のAPIキーが必要です。拡張機能の利用とは別に、プロバイダーの料金や利用条件が適用されます。すべてのモデルで同じ機能・品質を保証するものではありません。

AI機能を使うと、対象テキストとAPIキーを対応プロバイダーへ直接送信します。APIキーはブラウザ内に平文保存されます。独自サーバーや利用状況の分析機能はありません。対象サイトは設定で変更できます。

Yeq6X/mazelingoをもとに、Firefox向けに開発・保守している独立したforkです。

## 審査担当者向けメモ

この拡張はFirefox Desktop 140以降向けのManifest V3拡張です。Android向けではありません。
TypeScriptをWXTでビルドしているため、元ソースのZIPを別途提出します。

再現手順:

1. ソースZIPを展開し、Node.js 26とnpmを利用する。
2. プロジェクトルートで `npm ci` を実行する。
3. `npm run zip:firefox` を実行する。
4. `.output/mazelingo-fx-0.5.0-firefox.zip` が提出用パッケージ、`.output/firefox-mv3/` がビルド結果となる。

拡張のアイコンからSidebarを開き、設定でプロバイダーと利用者自身のAPIキーを保存します。モデルを選択し、対象サイトを開いて翻訳を確認します。音声機能にはOpenAIのAPIキーが別途必要です。審査用のAPIキーはソースに含めていません。

データ申告は `authenticationInfo` と `websiteContent` を必須としてmanifestに記載しています。APIキーと対象テキストを機能に必要なプロバイダーへ直接送信し、独自バックエンドや分析サービスには送信しません。モデル候補の取得先とタイミングはプライバシーポリシーに記載しています。

`<all_urls>`は利用者が指定するWebサイトの翻訳に使用します。既定の対象はHTTPSサイトで、許可一覧・除外一覧で調整できます。Firefox Sidebarは利用者の操作から開きます。

## 提出時に記録する項目

- 提出コミットとZIPのSHA-256
- AMOの検証結果、提出日時、アドオンURL、バージョン状態
- 署名済みXPIの導入・再起動確認（署名取得後に実施）
