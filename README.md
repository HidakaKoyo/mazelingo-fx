# Mazelingo-FX — 文単位バイリンガルミックス翻訳ブラウザ拡張

Webページの文章を**文単位で英日（任意の2言語）に混ぜて表示**する、語学学習向けのブラウザ拡張です。
「日本語と英語を混ぜて読んでいるうちに、英語を英語のまま理解できるようになる」ことを狙っています。

**Mazelingo-FX**は、[Yeq6X/mazelingo](https://github.com/Yeq6X/mazelingo)を正式なupstreamとして保ちながら、Firefoxで継続して利用、保守できるようにした派生版です。
TypeScript、WXT、テスト環境への移行には、[L4Ph/mazelingo](https://github.com/L4Ph/mazelingo)の実装を技術的な基盤として使用しています。

upstreamが公開しているサービス：

- [Chrome Web Store版](https://chromewebstore.google.com/detail/mazelingo/bhdngeocokoeblnnlhjibojcadefimpi)
- [Web版（テキストを貼り付けて試す）](https://mazelingo-web.pages.dev)

これらはMazelingo-FXのFirefox配布先ではありません。

## できること

- ページ内の文を設定した割合で外国語に置き換え、クリックで原文と訳文を反転
- マウスオーバーで対訳を表示し、文法解説、語彙管理、音声読み上げ（TTS）を利用
- OpenRouterの保存済みAPIキーに応じたモデル候補と、直接プロバイダー用のカスタムモデルIDを使ってLLMを選択
- サイトごとの有効化、見えている範囲だけの翻訳、2層キャッシュによるAPI消費の抑制
- Firefox SidebarとChrome Side Panelで共通の設定・学習UIを利用

## 対応ブラウザ

| ブラウザ         | 位置づけ | UI         | 備考                                             |
| ---------------- | -------- | ---------- | ------------------------------------------------ |
| Firefox 140以降  | 第一対象 | Sidebar    | 通常版への恒久導入にはMozillaの署名済みXPIが必要 |
| Chrome、Chromium | 維持対象 | Side Panel | Chrome向けManifest V3ビルドを維持                |

ビルドの成功は、ストア配布や署名済みパッケージの公開を意味しません。
配布先が示されていない場合、通常版Firefoxへ恒久導入できるMazelingo-FXは未提供です。

## セットアップ

### Firefoxへ一時的に導入する

1. Node.js 22.18以降（CIの基準はNode.js 26）とnpmを用意し、`npm ci`を実行します。
2. `npm run build:firefox`を実行します。
3. Firefoxで`about:debugging#/runtime/this-firefox`を開き、「一時的なアドオンを読み込む」から`.output/firefox-mv3/manifest.json`を選択します。
4. ツールバーのMazelingoアイコンからSidebarを開き、モデルとAPIキーを設定します。

一時的に導入した拡張機能は、Firefoxを終了すると解除されます。再起動後は読み込み直してください。
通常版Firefoxへ恒久導入するには、Mozilla Add-ons（AMO）で署名されたXPIが必要です。ローカルで生成した未署名XPIや`.output/firefox-mv3/`は恒久導入できません。

### Chromeへ一時的に導入する

1. `npm ci`と`npm run build:chrome`を実行します。
2. `chrome://extensions`でデベロッパーモードを有効にします。
3. 「パッケージ化されていない拡張機能を読み込む」から`.output/chrome-mv3/`を選択します。

## モデルとサイトを設定する

SidebarまたはSide Panelで、利用するモデル、APIキー、翻訳対象サイトを設定します。
Mazelingo-FXの既定の`include`は`https://*`です。必要に応じて`include`と`exclude`の一覧で対象を絞ってください。

OpenRouter APIキーを保存すると、パネルを開いた時と「モデル候補を更新」を押した時に`/api/v1/models/user`から候補を取得します。OpenRouterのprovider設定、プライバシー設定、guardrailを反映した一覧のうち、Mazelingoが使うJSON Schema形式の構造化翻訳に対応するテキストモデルだけを表示します。

| プロバイダー | モデルの指定方法                                            | キー                     |
| ------------ | ----------------------------------------------------------- | ------------------------ |
| OpenRouter   | 取得した候補を選択（保存値は`openrouter/<vendor>/<model>`） | OpenRouter APIキー       |
| OpenAI       | カスタムに例: `gpt-4.1-mini`                                | OpenAI APIキー           |
| Anthropic    | カスタムに例: `claude-haiku-4-5`                            | Anthropic APIキー        |
| Gemini       | カスタムに例: `gemini-2.5-flash`                            | Google AI Studio APIキー |
| DeepSeek     | カスタムに例: `deepseek-chat`                               | DeepSeek APIキー         |
| GLM          | カスタムに例: `glm-4-*`                                     | Zhipu AI APIキー         |

候補一覧は取得時点のOpenRouter設定を反映しますが、残高、レート制限、障害などによる実行成功までは保証しません。一覧にない対応モデルは「カスタム」からIDを入力できますが、現在のプロバイダー判定規則に一致する必要があります。

うまく動かない場合は、対象ページのDevToolsコンソールで`[mlg:llm]`から始まるエラーを確認してください。
モデルIDの誤り、APIキーの不一致、提供終了モデルなどを切り分けられます。APIキーや閲覧内容はIssueやログへ貼り付けないでください。

### APIキーと対象テキストの取扱い

APIキーは暗号化せず、ブラウザ拡張の`storage.local`へ平文で保存します。
この保存先は、OSやブラウザの利用者から情報を守る秘密保管庫ではありません。共有端末や信頼できないプロファイルにはAPIキーを保存しないでください。

翻訳、文法解説、文章へのフィードバック、語彙分析、クイズ生成では、対象テキストとAPIキーをバックグラウンド処理から選択したプロバイダーへ直接送信します。
音声読み上げでは、対象テキストとAPIキーをOpenAIへ直接送信します。
OpenRouterのモデル候補を取得するときは、OpenRouter APIキーだけをOpenRouterへ送信し、閲覧中の本文は送信しません。
独自の中継サーバーや利用状況の分析機能はありません。各プロバイダーの利用規約とデータ保持方針を確認してください。

## 開発

```bash
npm ci                  # postinstallでwxt prepareも実行
npm run dev             # Chrome向けWXT開発サーバー
npm run dev:firefox     # 一時プロファイルでFirefox向け開発版を実行
npm run dev:firefox:lab # 設定を保持する専用Firefox Labで実行
npm run build           # Chrome向けビルド
npm run build:local     # Chrome向けビルド + リポジトリ直下へミラー
npm run build:firefox   # Firefox Manifest V3ビルド
npm run zip             # Chrome向け提出用ZIP
npm run zip:firefox     # Firefox向け提出用ZIP
npm run compile         # TypeScript型検査
npm run lint            # lint
npm test                # Vitest + manifest検査
npm run test:e2e        # Playwright E2E
```

TypeScriptはstrictモード、ビルドはWXTです。
詳しい手順は[開発手順](docs/DEVELOPMENT.md)、確認項目は[テスト](docs/TESTING.md)を参照してください。

### Firefox Labでdogfoodingする

`npm run dev:firefox:lab`は、`~/.mazelingo-fx/firefox-lab`に同期しない`web-ext`専用プロファイルを作成して再利用します。
通常利用のFirefoxプロファイルや自動テスト用プロファイルは選択、複製、同期しません。
Labに保存したMazelingoの設定とキャッシュは次回起動にも残りますが、開発版は一時アドオンなので、Firefoxまたは開発プロセスを終了した後は同じコマンドで再導入してください。

Labは実利用のdogfooding用です。翻訳や文法解説を実行した本文は選択したプロバイダーへ送信されるため、APIキーや閲覧内容をIssue、コンソール、ログへ記録しないでください。

## 仕組み（要点）

- content scriptが、子にブロック要素を持たない末端ブロックを抽出し、改行と文末を基準にHTML断片へ分割してLLMへ渡す
- LLMがHTMLを保ったまま読みの単位へ分割、翻訳し、長すぎる単位だけをもう一度再分割する
- `location.href`と本文をシードにした決定的な割当で、同じページを再訪したときの言語ミックスを安定させる
- バックグラウンド処理がプロバイダー通信、翻訳キャッシュ、語彙処理を担当する
- WXTがFirefoxの`sidebar_action`とChromeの`side_panel`、各ブラウザのbackground形式を生成し分ける

詳しくは[アーキテクチャ](docs/ARCHITECTURE.md)と[Firefox移植](docs/FIREFOX_PORT.md)を参照してください。

## Upstreamと実装の由来

- 正式なupstream：[Yeq6X/mazelingo](https://github.com/Yeq6X/mazelingo)
- 技術的な基盤として使用したWXT実装：[L4Ph/mazelingo](https://github.com/L4Ph/mazelingo)
- Mazelingo-FXで追加した要素：Firefox Sidebar対応、ブラウザ差分の隔離、複数ブラウザ向けのビルド、テスト、文書

L4Phの`feature/wxt-typescript-migration`にあるコミット`ddd6342`を、Yeq6X upstreamの`6b91045`を起点とする作業ブランチへfast-forwardで取り込みました。
ファイルの複製ではないため、実装の由来をGitで追跡できます。
リモートの構成と追従手順は[Upstreamと履歴](docs/UPSTREAM.md)に記録しています。

## コントリビュート

IssueとPull Requestを歓迎します。
バグ報告には、利用したモデルID、秘密情報を除いたエラー、対象ページのURLを添えてください。

## 謝辞

Mazelingo-FXは、Yeq6X氏が公開したオリジナル版Mazelingoを基にしています。
Mazelingoをオープンソースとして公開してくださったことに感謝します。

## ライセンス

MIT Licenseです。
元プロジェクトの著作権表示とライセンス本文は[LICENSE](LICENSE)に保持しています。
L4Ph版を技術的な基盤にした事実は、上記のとおり明示しています。
