# Mazelingo — 文単位バイリンガルミックス翻訳 Chrome 拡張

Webページの文章を**文単位で英日(任意の2言語)ミックス表示**する語学学習向け拡張です。
「日本語と英語を混ぜて読んでいるうちに、英語を英語のまま理解できるようになる」を狙っています。

- Chrome Web Store: https://chromewebstore.google.com/detail/mazelingo/bhdngeocokoeblnnlhjibojcadefimpi
- Web版(貼り付けて試す): https://mazelingo-web.pages.dev

## できること

- ページ内の文を一定の割合(スライダー)で外国語に置き換えて表示。クリックで原文⇄訳文を反転
- hoverで対訳の吹き出し、文法解説、語彙トラッカー、音声読み上げ(TTS)
- 翻訳はあなたの **LLM APIキー**で動きます(OpenAI / Anthropic / Gemini / GLM / DeepSeek / **OpenRouter**)。拡張側にサーバーはなく、キーは Chrome Storage にだけ保存されます
- サイトごとのオプトイン/オプトアウト、見えている範囲だけ翻訳、2層キャッシュでAPI消費を節約

## セットアップ

1. ストアからインストール(または `chrome://extensions` → デベロッパーモード → 「パッケージ化されていない拡張機能を読み込む」でこのフォルダ)
2. ツールバーのアイコン → サイドパネルの **設定** で、使うモデルを選び **APIキー**を入力して保存
   - OpenAI: `gpt-4.1-mini` など / Anthropic: `claude-haiku-4-5-…` / Gemini: `gemini-2.5-flash` 等(Google AI Studio のキー)
   - **OpenRouter**: モデルを `openrouter/<vendor>/<model>`(例 `openrouter/openai/gpt-4.1-mini`)と指定し、OpenRouter のキーを入力。一覧に無いモデルは「カスタム…」で任意IDを入力できます
3. 翻訳したいページを開く(既定はオプトイン方式。サイドパネルの「現在のサイトを追加」で対象に)

うまく動かないときは、対象ページで DevTools(F12)のコンソールを開くと `[mlg:llm]` で始まる行に API からのエラー文が出ます。モデル名の誤り・キーの不一致・提供終了モデルが主な原因です(エラー文をサイドパネルに表示する改善は次のバージョンで予定)。

## 開発

```bash
npm install
npm run build   # terser で dist/ と mazelingo.zip を生成
```

Vanilla JS(ESM)・フレームワーク不使用。構成は `CLAUDE.md` を参照。`test/` にモデル疎通スクリプトがあります(`.env.example` をコピーして `.env` にキーを置く)。

## 仕組み(要点)

- content script が「子にブロック要素を持たない末端ブロック」を抽出し、改行(文末記号のあと)で釣り合ったHTML断片に分割してから LLM に渡す
- LLM は HTML を保ったまま「読みの単位」(文・長文は節)に分割し、各単位を翻訳して返す。長すぎる単位はもう1回だけ再分割を依頼
- 表示言語の割当は `location.href + 本文` をシードにした決定的な擬似乱数(同じページを再訪しても同じミックス)

## コントリビュート

Issue / PR 歓迎です。バグ報告には「使ったモデル名」「サイドパネルに出たエラー文」「対象ページのURL」を添えてください。

## ライセンス

MIT
