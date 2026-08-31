# 開発手順

## 必要な環境

開発には、次の環境を使用します。

- Node.js 26（CIの基準）
- npm（`package-lock.json`を使用）
- Firefox

ChromeまたはChromiumは、Firefox向け成果物を開発するための必須環境ではありません。CIがソース互換性を確認する対象です。

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
npm run dev:firefox:lab
npm run build:firefox
```

配布用に近い生成物は、`.output/firefox-mv3/`へ出力されます。
Firefoxが自動で起動しない環境では、`about:debugging#/runtime/this-firefox`を開きます。
「一時的なアドオンを読み込む」から、生成した`manifest.json`を選択してください。
通常版Firefoxへの恒久配布には、Mozillaが署名したXPIが必要です。

Mazelingo-FXの正式な対象はFirefox Desktop 140以降です。Firefoxの署名、配布、リリース手順は[リリース手順](RELEASING.md)を参照してください。

## Firefox Labで開発とdogfoodingを行う

`Mazelingo-FX Lab`は、実際の閲覧ページで翻訳・文法解説を試すための、同期しない`web-ext`専用Firefoxプロファイルです。Firefoxのプロファイル選択画面に作成・表示するものではありません。Lab起動時に`~/.mazelingo-fx/firefox-lab`を自動作成し、通常利用のFirefoxプロファイルやMCP Test用プロファイルを選択、複製、同期しません。

```bash
npm run dev:firefox:lab
```

この入口だけがWXTの`webExt.firefoxProfile`と`keepProfileChanges`を有効にします。そのため、Labに保存したMazelingoの設定とキャッシュは次回のLab起動にも残ります。通常の`npm run dev:firefox`は従来どおり一時プロファイルで起動します。

LabではWXTが開発版を一時アドオンとして導入します。Firefoxまたは開発プロセスを終了した後に再開するときは、もう一度`npm run dev:firefox:lab`を実行して一時アドオンを再導入します。Labには実際に閲覧するページを開いてよい一方、翻訳や文法解説を実行した本文は選択したプロバイダーへ送信されます。APIキーや閲覧内容をIssue、コンソール、ログへ記録しません。

MCP TestはLabとは別のクリーンな専用プロファイルで起動します。Labを`firefox-devtools-mcp`へ接続したり、MCP Testの設定やキャッシュをLabへ持ち込んだりしません。MCP Testは自動確認、Labは実利用のdogfoodingという役割を保ちます。

## Chromium互換性を確認する

```bash
npm run dev
npm run build:chrome
```

`.output/chrome-mv3/`は、上流追従時にブラウザ境界が壊れていないことを確認するための生成物です。
Mazelingo-FXはChromeまたはChromium向けの配布、利用者サポート、実ブラウザの回帰保証を行いません。

## 品質を確認する

```bash
npx wxt prepare          # 何も生成されていない環境でWXTの型を生成する
npm run compile          # TypeScriptの型を検査する
npm run lint             # oxlintを実行する
npm run fmt -- --check   # 書式を検査する
npm test                 # Vitestによる単体テストとDOMテストを実行する
npm run test:e2e         # Playwright E2Eを実行する（現在はChromium中心）
```

CIのjobとrelease gateの意味は[テスト](TESTING.md)を、branchと上流同期は[Upstream運用](UPSTREAM.md)を参照してください。

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
- `e2e/`：Chromium互換性の診断用Playwright E2E
- `docs/`：アーキテクチャ、Firefox向け配布、upstream追従、テスト手順

共通処理へブラウザ判定を追加する前に、manifestの設定またはパネルのアダプターへ差分を閉じ込められないか確認してください。

## 新しい開発を始める

1. [CONTRIBUTING.md](../CONTRIBUTING.md)で対象範囲とbranchの種類を確認します。
2. `origin/main`から`feat/*`または`fix/*`を作り、Firefoxを基準に実装します。
3. browser-neutralな変更は、Yeq6X/mazelingoへ還元できるかをPull Requestで記録します。
4. 上流変更を取り込む場合だけ、[Upstream運用](UPSTREAM.md)の`sync/yeq6x-*`手順を使います。`main`で上流を直接pullしません。

## APIキーを使うテスト

`npm test`は、実際のAPIキーを必要としません。
`test/`にあるプロバイダー疎通用スクリプトを使う場合だけ、`.env.example`をもとにローカルの`.env`を作ります。
`.env`、コンソール、テスト生成物、issue、CIログへ実際のAPIキーを残さないでください。
