# 開発手順

## Prerequisite

- Node.js 26（CI基準）
- npm（`package-lock.json`を使用）
- Firefox
- ChromeまたはChromium

## Setup

```bash
git clone https://github.com/HidakaKoyo/mazelingo-fx.git
cd mazelingo-fx
npm ci
```

依存更新が目的でない通常開発・CIでは、lockfileを尊重する`npm ci`を使います。

## Firefox

```bash
npm run dev:firefox
npm run build:firefox
```

release相当の生成先は`.output/firefox-mv3/`です。自動起動しない環境では`about:debugging#/runtime/this-firefox`の「一時的なアドオンを読み込む」から生成した`manifest.json`を選びます。通常版Firefoxへの恒久配布にはMozilla署名済みXPIが必要です。

## Chrome

```bash
npm run dev
npm run build:chrome
```

release相当の生成先は`.output/chrome-mv3/`です。手動読込時は`chrome://extensions`のdeveloper modeから指定します。

## Quality commands

```bash
npx wxt prepare          # clean環境でWXT型を生成
npm run compile          # TypeScript typecheck
npm run lint             # oxlint
npm run fmt -- --check
npm test                 # Vitest unit / DOM tests
npm run test:e2e         # Playwright E2E（現状Chromium中心）
```

## Buildとmanifest確認

```bash
npm run build:firefox
npm run build:chrome
npm run verify:manifests
sed -n '1,220p' .output/firefox-mv3/manifest.json
sed -n '1,220p' .output/chrome-mv3/manifest.json
```

Firefox生成物にはChrome固有の`side_panel` / `sidePanel`がなく、Firefox Sidebar定義があることを確認します。Chromeではその逆を確認します。

## 構成

- `entrypoints/`: background、content、sidepanel、options
- `utils/`: DOM、翻訳、provider、cache、storage key、message schema
- `public/`: icon、語彙、situation data
- `e2e/`: Playwright E2E
- `docs/`: architecture、移植判断、upstream追従、test手順

共通logicへbrowser判定を追加する前に、manifest configまたはpanel adapterで差分を閉じられないか確認してください。

## API keyを使うtest

`npm test`は実API keyを必要としません。`test/`のprovider疎通scriptを使う場合だけ`.env.example`をもとにlocal `.env`を作ります。`.env`、console、test artifact、issue、CI logへ実keyを残さないでください。
