# テスト

## 自動確認

```bash
npm ci
npx wxt prepare
npm run compile
npm run lint
npm run fmt -- --check
npm test
npm run build:firefox
npm run build:chrome
npm run verify:manifests
npm run test:e2e
```

Playwright E2Eは現状Chromium中心です。Firefox Sidebarのmanual checklistを自動E2Eの代替として「pass」にせず、別の確認結果として記録してください。

## 2026-08-23 Firefox smoke結果

- 環境: macOS、Mozilla公式Firefox 154.0、`.output/firefox-mv3`
- temporary install: `web-ext run`で成功
- toolbar / Sidebar: ExtensionsメニューのMazelingo-FXを押してSidebarが開き、設定UIが表示された
- storage: 非機密のダミーAPI keyを保存し、Firefox終了後に同じ開発profileへtemporary add-onを再installして値の復元を確認した
- 未実施: 実API keyによる翻訳・文法解説・TTS、SPA、window切り替え、署名済みXPIのinstall/update
- 補足: temporary add-onは再起動時に`web-ext`が再installしたため、署名済み恒久版のlifecycle検証ではない
- `web-ext lint`: error 0、notice 0。既存UIの`innerHTML`利用に関するwarningは残っており、AMO提出前の個別review対象

## 生成manifest

- [ ] Firefox manifestに`sidebar_action`があり、Chrome固有permissionがない
- [ ] Firefox manifestの`strict_min_version`が`140.0`である
- [ ] Firefox manifestに`side_panel`と`sidePanel`がない
- [ ] Firefox manifestに`background.scripts`があり、`background.service_worker`がない
- [ ] Chrome manifestに`side_panel`と`sidePanel`がある
- [ ] Chrome manifestに`sidebar_action`と`sidebarAction`がない
- [ ] Chrome manifestに`background.service_worker`がある
- [ ] background、content script、sidepanel、optionsが両buildに含まれる
- [ ] host permissionが実装に必要な範囲と一致する

## Firefox manual checklist

実施日、Firefox version、OS、build commit、使用provider、結果を記録します。API key自体は記録しません。

### Install / lifecycle

- [ ] `about:debugging`からtemporary installできる
- [ ] extension reload後にerrorなく再実行できる
- [ ] Firefox終了後、temporary installが解除される
- [ ] 署名済みXPIがある場合、通常版Firefoxへ恒久installできる
- [ ] 旧buildからupdateした場合、設定とcacheの維持を確認する

### Sidebar

- [ ] toolbar iconでSidebarが開く
- [ ] Sidebarを閉じ、再度開ける
- [ ] tab切り替え後も操作できる
- [ ] window切り替え時にSidebarと対象tabが正しい
- [ ] extension reload後に開き直せる
- [ ] browser restart後、署名済み恒久版で開ける

### Configuration / storage

- [ ] API keyを保存できる
- [ ] OpenAI / Anthropic / Gemini / OpenRouter / DeepSeek / GLMを選べる
- [ ] model、言語、mix比率、対象site設定がpanelを閉じても残る
- [ ] page reload後も設定が残る
- [ ] browser restart後も設定が残る（恒久版）
- [ ] site allowlist / denylistが動く
- [ ] 翻訳cacheが再訪時に利用され、clearできる
- [ ] 語彙と保存した利用例が再表示される

### Translation / page interaction

- [ ] Webページの文章を抽出できる
- [ ] 許可したsiteだけで翻訳が動く
- [ ] 原文 / 翻訳文がmix表示される
- [ ] clickで原文と訳文を切り替えられる
- [ ] hoverで対訳を表示できる
- [ ] 文法解説を表示できる
- [ ] 語彙を追加・表示できる
- [ ] OpenAI TTSを再生できる
- [ ] reload、通常navigation後に動く
- [ ] SPA navigation後に新しい本文を処理する
- [ ] `pushState` / `replaceState` / back / forward後に動く
- [ ] 動的に追加された本文を処理する

### Provider / networking

- [ ] OpenAIで翻訳できる
- [ ] Anthropicで翻訳できる
- [ ] Geminiで翻訳できる
- [ ] OpenRouterで翻訳できる
- [ ] DeepSeek / GLMで翻訳できる（利用対象の場合）
- [ ] invalid keyのerrorを認識できる
- [ ] requestが選択providerへ直接送信される
- [ ] Firefox CSP / CORS / host permission errorがない
- [ ] console、error、test artifactにAPI keyが出ない

## Chrome regression checklist

- [ ] unpacked extensionとしてinstallできる
- [ ] toolbar iconでSide Panelが開く
- [ ] 設定を保存できる
- [ ] 翻訳、mix表示、click、hoverが動く
- [ ] 文法解説、語彙、TTSが動く
- [ ] reloadとSPA navigation後も動く
- [ ] browser restart後も設定が残る

## Test境界

- build成功はFirefox Sidebarの実操作を証明しない
- temporary installはbrowser restart後の永続性を検証できない
- provider mock testは実endpointのCSP、認証、model提供状態を検証しない
- 実keyで確認できないproviderは未実施のまま記録する
