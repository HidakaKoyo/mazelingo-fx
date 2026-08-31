# Mazelingo

Sentence-level bilingual mix translator。Webページのテキストを文単位で外国語とミックス表示する語学学習向けChrome拡張(Manifest V3)。

Chrome Web Store: https://chromewebstore.google.com/detail/mazelingo/bhdngeocokoeblnnlhjibojcadefimpi

## ビルド・開発

```bash
npm install        # 依存: wxt, typescript, vitest, playwright (devDependencies)
npm run dev        # wxt (HMR付き開発サーバー)
npm run build      # wxt build → .output/chrome-mv3/ 生成
npm run build:local # 同上 + 直下へミラー。chrome://extensions で直下を読み込んでいる既存項目の「再読み込み」で反映(拡張IDと chrome.storage を維持)
npm run zip        # wxt zip → mazelingo.zip (Chrome Web Store配布用)
npm run compile    # tsc --noEmit (型チェック)
npm test           # vitest (ユニット/純ロジック + jsdom DOMテスト)
npm run test:e2e   # playwright (ビルド済み拡張を実ブラウザでE2E)
```

- UIフレームワーク不使用のTypeScript(strict)。ビルドはWXT(エントリをバンドルし`.output/`に出力)
- `test/` に LLM モデル動作検証スクリプト (test_llm.ts, test_models.js, test_deepl.js)。ライブAPI要のため CI 対象外。`.env` にAPIキーを置いて実行(`.env.example` 参照)。`npm run test:llm -- <model> <api-key>`は本体の`utils/llm.ts`経由で1回翻訳する

## 構造

- `wxt.config.ts` — manifest とビルド設定
- `entrypoints/background.ts` — service worker。翻訳バッチ・2層キャッシュ・長ユニット再分割
- `entrypoints/content/index.ts` + `style.css` — ページ注入(リーフブロック検出・改行境界での断片化)・翻訳表示UI(トグル/ツールチップ)
- `entrypoints/sidepanel/` — サイドパネルUI(設定/出力タブ、最大規模ファイル)
- `utils/llm.ts` — OpenAI / Anthropic / Gemini / GLM / DeepSeek / OpenRouter のリクエストビルダーと呼び分け (callLLMChain)
- `utils/config.ts` — デフォルト設定とマージ処理
- `utils/translation.ts` / `utils/content-logic.ts` / `utils/dom-overlay.ts` — 純粋ロジック(テスト対象の seam)
- `utils/messages.ts` — 3 コンテキスト間の型付きメッセージプロトコル
- `public/vocab_data.json` / `public/situations.json` — 学習コンテンツ (web_accessible_resources)
- `docs/` — privacy-policy.md(ストア申請用)・スクリーンショット

## ルール

- APIキーはユーザーが設定画面から入力し Chrome Storage に保存する設計。**ソースにハードコードしない**
- `.env` はローカル検証用(gitignore済み)。内容を転記・コミットしない
- 翻訳の文分割は「読みの単位」: 改行(文末記号のあとは決定的、それ以外はLLM判断)・句読点・長文は節で分割。プロンプトは `utils/translation.ts` の `buildTranslationMessages` を参照
