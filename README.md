# Mazelingo-FX

Mazelingoは、Webページの文章を文単位で2言語にミックス表示する語学学習向けブラウザ拡張です。クリックによる原文との切り替え、hover対訳、文法解説、語彙管理、音声読み上げ（TTS）、サイト単位の有効化、翻訳cacheを備えます。

Mazelingo-FXは、[Yeq6X/mazelingo](https://github.com/Yeq6X/mazelingo)を正式なupstreamとして保ちながら、Firefoxで継続的に利用・保守できるようにした派生版です。TypeScript、WXT、test環境への移行には[L4Ph/mazelingo](https://github.com/L4Ph/mazelingo)の実装を技術的なベースとして使用しています。

## 対応ブラウザ

| ブラウザ          | 状態           | UI         | 備考                                                |
| ----------------- | -------------- | ---------- | --------------------------------------------------- |
| Firefox 140以降   | 第一ターゲット | Sidebar    | 通常版への恒久installにはMozillaの署名済みXPIが必要 |
| Chrome / Chromium | 維持対象       | Side Panel | WXTのChrome MV3 buildを維持                         |

build成功と、store配布・署名済みpackageの公開は別です。配布リンクがない場合、通常版Firefoxで恒久利用できる版はまだ提供されていません。

## Install

### 通常版Firefox

恒久installにはMozilla Add-ons（AMO）で署名されたXPIが必要です。署名済みXPIまたはAMO配布ページからinstallしてください。ローカル生成した未署名XPIや`.output/firefox-mv3/`を通常版Firefoxへ恒久installすることはできません。

### Firefoxでtemporary install（開発・確認用）

1. `npm ci`、`npm run build:firefox`を実行します。
2. Firefoxで`about:debugging#/runtime/this-firefox`を開きます。
3. 「一時的なアドオンを読み込む」を押します。
4. `.output/firefox-mv3/manifest.json`を選択します。

temporary installはFirefox終了時に解除されます。再起動後は読み込み直してください。普段の開発には`npm run dev:firefox`を使えます。

### Chromeでtemporary install

`npm run build:chrome`後、`chrome://extensions`でdeveloper modeを有効にし、「パッケージ化されていない拡張機能を読み込む」から`.output/chrome-mv3/`を選びます。

## Configuration

Sidebar / Side PanelでmodelとAPI key、翻訳対象siteを設定します。既定のinclude設定は`https://*`で、すべてのHTTPS siteが有効です。必要に応じてinclude / exclude listで対象を絞ってください。

| Provider   | model例                          | key                      |
| ---------- | -------------------------------- | ------------------------ |
| OpenAI     | `gpt-4.1-mini`                   | OpenAI API key           |
| Anthropic  | `claude-haiku-4-5`               | Anthropic API key        |
| Gemini     | `gemini-2.5-flash`               | Google AI Studio API key |
| OpenRouter | `openrouter/openai/gpt-4.1-mini` | OpenRouter API key       |
| DeepSeek   | `deepseek-chat`                  | DeepSeek API key         |
| GLM        | `glm-4-*`                        | Zhipu AI API key         |

一覧にない対応modelは「カスタム」からIDを入力できます。ただし未知のproviderが自動的に使えるわけではなく、現在のprovider判定規則に一致する必要があります。

### API keyの保存と送信

API keyは暗号化されず、ブラウザ拡張の`storage.local`に平文保存されます。OSやbrowserの利用者から保護する秘密保管庫ではありません。共有端末や信頼できないprofileでは保存しないでください。

翻訳、文法解説、writing feedback、語彙分析、quiz生成はbackgroundから選択provider（OpenAI、Anthropic、Gemini、OpenRouter、DeepSeek、GLM）へ直接送信されます。TTSはOpenAIへ直接送信されます。独自の中継serverやanalyticsはありませんが、providerには各機能の対象textと対応するAPI keyが送られます。provider側の利用規約とdata保持方針を確認してください。

## Development

Node.js 26とnpmを基準環境とします（CIと同じversion）。

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

詳細は[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)、確認項目は[docs/TESTING.md](docs/TESTING.md)を参照してください。

## Architecture

WXTがbackground、content script、Sidebar / Side Panel、optionsを各browser向けにbundleします。DOM抽出・翻訳・cacheなどの共通logicは`utils/`へ置き、browser固有のpanel操作とmanifest差分は小さな境界へ隔離します。詳細は[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)と[docs/FIREFOX_PORT.md](docs/FIREFOX_PORT.md)を参照してください。

## Upstreamと由来

- Original project / official upstream: [Yeq6X/mazelingo](https://github.com/Yeq6X/mazelingo)
- WXT implementation used as technical base: [L4Ph/mazelingo](https://github.com/L4Ph/mazelingo)
- Mazelingo-FX: Firefox Sidebar対応、browser差分の隔離、multi-browser build・test・文書を追加

L4Phの`feature/wxt-typescript-migration`にあるcommit `ddd6342`を、Yeq6X upstreamの`6b91045`を起点とする作業branchへfast-forwardして取り込みました。ファイルコピーではなく、由来をGitで追跡できます。remoteと追従手順は[docs/UPSTREAM.md](docs/UPSTREAM.md)に記録しています。

## License

MIT Licenseです。元projectのcopyright noticeと本文は[LICENSE](LICENSE)に保持しています。L4Ph版を技術的なベースにした事実は上記のとおり明示します。
