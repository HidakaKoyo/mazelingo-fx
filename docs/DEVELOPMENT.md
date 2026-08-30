# 開発手順

## 必要な環境

開発には、次の環境を使用します。

- Node.js 26（CIの基準）
- npm（`package-lock.json`を使用）
- Firefox
- ChromeまたはChromium

## 開発環境を準備する

```bash
git clone https://github.com/HidakaKoyo/mazelingo-fx.git
cd mazelingo-fx
npm ci
```

依存関係の更新を目的としない通常の開発とCIでは、ロックファイルを尊重する`npm ci`を使います。

## Firefox向けに実行、ビルドする

```bash
npm run dev:firefox
npm run build:firefox
```

配布用に近い生成物は、`.output/firefox-mv3/`へ出力されます。
Firefoxが自動で起動しない環境では、`about:debugging#/runtime/this-firefox`を開きます。
「一時的なアドオンを読み込む」から、生成した`manifest.json`を選択してください。
通常版Firefoxへの恒久配布には、Mozillaが署名したXPIが必要です。

## Chrome向けに実行、ビルドする

```bash
npm run dev
npm run build:chrome
```

配布用に近い生成物は、`.output/chrome-mv3/`へ出力されます。
手動で読み込む場合は、`chrome://extensions`のデベロッパーモードから生成先を指定します。

## 品質を確認する

```bash
npx wxt prepare          # 何も生成されていない環境でWXTの型を生成する
npm run compile          # TypeScriptの型を検査する
npm run lint             # oxlintを実行する
npm run fmt -- --check   # 書式を検査する
npm test                 # Vitestによる単体テストとDOMテストを実行する
npm run test:e2e         # Playwright E2Eを実行する（現在はChromium中心）
```

## ビルド結果とmanifestを確認する

```bash
npm run build:firefox
npm run build:chrome
npm run verify:manifests
sed -n '1,220p' .output/firefox-mv3/manifest.json
sed -n '1,220p' .output/chrome-mv3/manifest.json
```

Firefoxの生成物には、Firefox Sidebarの定義があり、Chrome固有の`side_panel`と`sidePanel`がないことを確認します。
Chromeの生成物では、反対の構成になっていることを確認します。

## ディレクトリ構成

主要なディレクトリは、次の役割に分かれています。

- `entrypoints/`：バックグラウンド処理、コンテンツスクリプト、サイドパネル、設定画面
- `utils/`：DOM、翻訳、プロバイダー、キャッシュ、保存用キー、メッセージのスキーマ
- `public/`：アイコン、語彙、場面別データ
- `e2e/`：Playwright E2E
- `docs/`：アーキテクチャ、移植時の判断、upstream追従、テスト手順

共通処理へブラウザ判定を追加する前に、manifestの設定またはパネルのアダプターへ差分を閉じ込められないか確認してください。

## APIキーを使うテスト

`npm test`は、実際のAPIキーを必要としません。
`test/`にあるプロバイダー疎通用スクリプトを使う場合だけ、`.env.example`をもとにローカルの`.env`を作ります。
`.env`、コンソール、テスト生成物、issue、CIログへ実際のAPIキーを残さないでください。
