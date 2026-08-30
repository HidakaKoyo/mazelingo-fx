# Mazelingo-FX

**Mazelingo**は、Webページの文章を文単位で二つの言語に混ぜて表示する、語学学習向けのブラウザ拡張です。
クリックによる原文との切り替え、マウスオーバーによる対訳表示、文法解説、語彙管理、音声読み上げ（TTS）、サイト単位の有効化、翻訳キャッシュに対応します。

**Mazelingo-FX**は、[Yeq6X/mazelingo](https://github.com/Yeq6X/mazelingo)を正式なupstreamとして保ちながら、Firefoxで継続して利用、保守できるようにした派生版です。
TypeScript、WXT、テスト環境への移行には、[L4Ph/mazelingo](https://github.com/L4Ph/mazelingo)の実装を技術的な基盤として使用しています。

## 対応ブラウザ

| ブラウザ         | 位置づけ | UI         | 備考                                             |
| ---------------- | -------- | ---------- | ------------------------------------------------ |
| Firefox 140以降  | 第一対象 | Sidebar    | 通常版への恒久導入にはMozillaの署名済みXPIが必要 |
| Chrome、Chromium | 維持対象 | Side Panel | Chrome向けManifest V3ビルドを維持                |

ビルドの成功は、ストア配布や署名済みパッケージの公開を意味しません。
配布先が示されていない場合、通常版Firefoxへ恒久導入できる版は未提供です。

## クイックスタート（Firefoxで確認する）

1. Node.js 26とnpmを用意し、`npm ci`を実行します。
2. `npm run build:firefox`を実行します。
3. Firefoxで`about:debugging#/runtime/this-firefox`を開き、「一時的なアドオンを読み込む」から`.output/firefox-mv3/manifest.json`を選択します。
4. 拡張機能のツールバー操作からSidebarを開き、利用するプロバイダー、モデル、APIキーを設定します。

一時的に導入した拡張機能は、Firefoxを終了すると解除されます。APIキーはリポジトリやログへ保存しないでください。

## 導入方法

### 通常版Firefoxへ導入する

恒久導入には、Mozilla Add-ons（AMO）で署名されたXPIが必要です。
署名済みXPIまたはAMOの配布ページから導入してください。
ローカルで生成した未署名XPIや`.output/firefox-mv3/`は、通常版Firefoxへ恒久導入できません。

### Firefoxへ一時的に導入する

開発時や動作確認時は、次の手順で一時的に導入できます。

1. `npm ci`と`npm run build:firefox`を実行します。
2. Firefoxで`about:debugging#/runtime/this-firefox`を開きます。
3. 「一時的なアドオンを読み込む」を押します。
4. `.output/firefox-mv3/manifest.json`を選択します。

一時的に導入した拡張機能は、Firefoxの終了時に解除されます。
再起動後は読み込み直してください。
普段の開発には`npm run dev:firefox`も使用できます。

### Chromeへ一時的に導入する

`npm run build:chrome`を実行した後、`chrome://extensions`でデベロッパーモードを有効にします。
「パッケージ化されていない拡張機能を読み込む」から`.output/chrome-mv3/`を選択してください。

## 設定

SidebarまたはSide Panelで、モデル、APIキー、翻訳対象サイトを設定します。
既定の`include`は`https://*`であり、すべてのHTTPSサイトが有効です。
必要に応じて`include`と`exclude`の一覧で対象を絞ってください。

| プロバイダー | モデルの例                       | キー                     |
| ------------ | -------------------------------- | ------------------------ |
| OpenAI       | `gpt-4.1-mini`                   | OpenAI APIキー           |
| Anthropic    | `claude-haiku-4-5`               | Anthropic APIキー        |
| Gemini       | `gemini-2.5-flash`               | Google AI Studio APIキー |
| OpenRouter   | `openrouter/openai/gpt-4.1-mini` | OpenRouter APIキー       |
| DeepSeek     | `deepseek-chat`                  | DeepSeek APIキー         |
| GLM          | `glm-4-*`                        | Zhipu AI APIキー         |

一覧にない対応モデルは、「カスタム」からIDを入力できます。
ただし、未知のプロバイダーが自動的に利用可能になるわけではなく、現在のプロバイダー判定規則に一致する必要があります。

### APIキーを保存、送信する仕組み

APIキーは暗号化せず、ブラウザ拡張の`storage.local`へ平文で保存します。
この保存先は、OSやブラウザの利用者から情報を守る秘密保管庫ではありません。
共有端末や信頼できないプロファイルにはAPIキーを保存しないでください。

翻訳、文法解説、文章へのフィードバック、語彙分析、クイズ生成では、対象テキストとAPIキーをバックグラウンド処理から選択したプロバイダーへ直接送信します。
対象となるプロバイダーは、OpenAI、Anthropic、Gemini、OpenRouter、DeepSeek、GLMです。
音声読み上げでは、対象テキストとAPIキーをOpenAIへ直接送信します。
独自の中継サーバーや利用状況の分析機能はありません。
各プロバイダーの利用規約とデータ保持方針を確認してください。

## 開発

基準環境は、CIと同じNode.js 26とnpmです。

```bash
git clone https://github.com/HidakaKoyo/mazelingo-fx.git
cd mazelingo-fx
npm ci
npm run dev:firefox
npm run build:firefox
npm run build:chrome
npm run compile
npm run lint
npm test
```

詳しい手順は[開発手順](docs/DEVELOPMENT.md)、確認項目は[テスト](docs/TESTING.md)を参照してください。

## アーキテクチャ

WXTは、バックグラウンド処理、コンテンツスクリプト、SidebarまたはSide Panel、設定画面をブラウザごとにまとめます。
DOMの抽出、翻訳、キャッシュなどの共通処理は`utils/`へ置き、ブラウザ固有のパネル操作とmanifestの差分は小さな境界へ隔離します。
詳しくは[アーキテクチャ](docs/ARCHITECTURE.md)と[Firefox移植](docs/FIREFOX_PORT.md)を参照してください。

## Upstreamと実装の由来

- 正式なupstream：[Yeq6X/mazelingo](https://github.com/Yeq6X/mazelingo)
- 技術的な基盤として使用したWXT実装：[L4Ph/mazelingo](https://github.com/L4Ph/mazelingo)
- Mazelingo-FXで追加した要素：Firefox Sidebar対応、ブラウザ差分の隔離、複数ブラウザ向けのビルド、テスト、文書

L4Phの`feature/wxt-typescript-migration`にあるコミット`ddd6342`を、Yeq6X upstreamの`6b91045`を起点とする作業ブランチへfast-forwardで取り込みました。
ファイルの複製ではないため、実装の由来をGitで追跡できます。
リモートの構成と追従手順は[Upstreamと履歴](docs/UPSTREAM.md)に記録しています。

### 謝辞

Mazelingo-FXは、Yeq6X氏が公開したオリジナル版Mazelingoを基にしています。
Mazelingoをオープンソースとして公開してくださったことに感謝します。

## ライセンス

ライセンスはMIT Licenseです。
元プロジェクトの著作権表示とライセンス本文は[LICENSE](LICENSE)に保持しています。
L4Ph版を技術的な基盤にした事実は、上記のとおり明示しています。
