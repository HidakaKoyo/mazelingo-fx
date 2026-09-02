# テスト

## CIの役割

Pull Requestと`main`へのpushでは、GitHub Actionsが次を実行します。

- **Core checks**：型検査、lint、書式、単体テスト、manifest検査のテスト
- **Firefox package checks**：Firefox build、Firefox manifest検査、`web-ext lint`
- **Chromium compatibility**：Chromium buildとChromium manifest検査。Firefox固有の分岐が共通処理へ混入していないことを確認するための検査で、配布・サポートの保証ではない

Firefoxの実ブラウザ操作、署名済みXPIの再起動後の確認、実際の外部プロバイダーとの通信はCIで代替しません。Firefoxリリースでは後述の手動確認と[リリース手順](RELEASING.md)が必要です。

## 自動検査をローカルで実行する

次のコマンドで、CIの必須検査をローカルで再現できます。`npm run test:e2e`は診断専用であり、Firefoxリリースの必須条件ではありません。

```bash
npm ci
npx wxt prepare
npm run compile
npm run lint
npm run fmt -- --check
npm test
npm run build:firefox
npm run lint:firefox
npm run build:chrome
npm run verify:manifests
```

## Chromium E2E診断

`npm run test:e2e`はCIから外したローカル診断です。Firefoxリリースの必須条件でも、Chromium compatibility検査の代替でもありません。

2026-09-02時点では、Playwright persistent-context harnessでextension pageからMV3 backgroundへのruntime message応答を観測できず、mock request・content script応答・DOM反映の段階へ進みません。テストは設定の保存、Service Workerからの設定read-back、runtime message、mock hit、外部通信遮断、DOM翻訳属性をこの順に検査し、最初に失敗した段階を示します。固定sleepは使わず、profileは実行ごとに一意に作成して終了時に削除します。

実APIキー・実プロバイダー通信は使いません。OpenAI hostの名前解決を失敗させ、許可外HTTPS requestをabortします。`context.route`がMV3 Service Worker由来のfetchを捕捉できないとは確認されていないため、production用test hookは追加していません。経緯、Firefox品質ゲートとの関係、再導入条件は[Issue #9](https://github.com/HidakaKoyo/mazelingo-fx/issues/9)を正本とします。

## 2026年8月23日のFirefox簡易確認

Firefox 154.0とmacOSを使い、`.output/firefox-mv3`を確認しました。

- 一時導入：`web-ext run`で成功
- ツールバーとSidebar：拡張機能メニューのMazelingo-FXを押すとSidebarが開き、設定UIを表示
- ローカル保存：機密情報ではないダミーのAPIキーを保存し、Firefox終了後に同じ開発用プロファイルへ一時アドオンを再導入して値の復元を確認
- 未実施：実際のAPIキーを使う翻訳、文法解説、TTS、SPA、ウィンドウ切り替え、署名済みXPIの導入と更新
- 補足：再起動時は`web-ext`が一時アドオンを再導入したため、署名済み恒久版のライフサイクルは未検証
- `web-ext lint`：エラー0件、通知0件、警告18件

`web-ext lint`の警告には、既存UIの`innerHTML`利用とAndroidの最小バージョンに関する指摘が含まれます。
AMOへ提出する前に、各警告を個別に確認する必要があります。

## 生成したmanifestを確認する

`npm run verify:manifests`は、次の項目と主要な生成物の存在を自動で検査します。

- [x] Firefoxのmanifestに`sidebar_action`があり、Chrome固有の権限がない
- [x] Firefoxのmanifestにある`strict_min_version`が`140.0`である
- [x] Firefoxのmanifestに`side_panel`と`sidePanel`がない
- [x] Firefoxのmanifestに`background.scripts`があり、`background.service_worker`がない
- [x] Chromeのmanifestに`side_panel`と`sidePanel`がある
- [x] Chromeのmanifestに`sidebar_action`と`sidebarAction`がない
- [x] Chromeのmanifestに`background.service_worker`がある
- [x] バックグラウンド処理とサイドパネルの生成物が両ビルドに含まれる
- [ ] ホスト権限が実装に必要な範囲と一致する

## Firefoxを手動で確認する

確認結果には、実施日、Firefoxのバージョン、OS、ビルドしたコミット、使用したプロバイダー、結果を記録します。
APIキー自体は記録しません。

### 導入とライフサイクル

- [ ] `about:debugging`から一時的に導入できる
- [ ] 拡張機能を再読み込みした後、エラーなく実行できる
- [ ] Firefox終了後、一時的な導入が解除される
- [ ] 署名済みXPIがある場合、通常版Firefoxへ恒久導入できる
- [ ] 旧版から更新した場合、設定とキャッシュを維持できる

### Sidebar

- [ ] ツールバーのアイコンからSidebarを開ける
- [ ] Sidebarを閉じた後、再度開ける
- [ ] タブを切り替えた後も操作できる
- [ ] ウィンドウ切り替え時にSidebarと対象タブが正しい
- [ ] 拡張機能の再読み込み後にSidebarを開き直せる
- [ ] ブラウザの再起動後、署名済み恒久版でSidebarを開ける

### 設定とローカル保存

- [ ] APIキーを保存できる
- [ ] 保存済みのOpenRouter APIキーで構造化翻訳対応の候補を取得でき、候補にないモデルは表示しない
- [ ] OpenAI、Anthropic、Gemini、DeepSeek、GLMの対応モデルIDをカスタム入力できる
- [ ] モデル、言語、混在率、対象サイトの設定がパネルを閉じても残る
- [ ] ページを再読み込みした後も設定が残る
- [ ] ブラウザを再起動した後も設定が残る（恒久版）
- [ ] サイトの許可一覧と除外一覧が機能する
- [ ] 再訪時に翻訳キャッシュを利用でき、消去もできる
- [ ] 語彙と保存した利用例を再表示できる

### 翻訳とページ操作

- [ ] Webページの文章を抽出できる
- [ ] 許可したサイトだけで翻訳が動く
- [ ] 原文と翻訳文を混ぜて表示できる
- [ ] クリックで原文と翻訳文を切り替えられる
- [ ] マウスオーバーで対訳を表示できる
- [ ] 文法解説を表示できる
- [ ] 文法解説の外部送信payloadに閲覧中のページURLが含まれない
- [ ] 語彙を追加、表示できる
- [ ] OpenAI TTSを再生できる
- [ ] 再読み込みと通常の画面遷移後に動く
- [ ] SPAによる画面遷移後に新しい本文を処理する
- [ ] `pushState`、`replaceState`、戻る、進むの各操作後に動く
- [ ] 動的に追加された本文を処理する

### プロバイダーと通信

- [ ] OpenAIで翻訳できる
- [ ] Anthropicで翻訳できる
- [ ] Geminiで翻訳できる
- [ ] OpenRouterで翻訳できる
- [ ] DeepSeekとGLMで翻訳できる（利用する場合）
- [ ] 無効なAPIキーのエラーを認識できる
- [ ] 要求を選択したプロバイダーへ直接送信する
- [ ] FirefoxでCSP、CORS、ホスト権限によるエラーがない
- [ ] コンソール、エラー、テスト生成物にAPIキーが出ない

## Chromium互換性を調査する

次の項目はFirefoxリリースの品質ゲートではありません。upstream同期やbrowser共通変更を調査するときだけ、必要に応じて実行します。

- [ ] 未圧縮の拡張機能として導入できる
- [ ] ツールバーのアイコンからSide Panelを開ける
- [ ] 設定を保存できる
- [ ] 翻訳、混在表示、クリック、マウスオーバーが動く
- [ ] 文法解説、語彙、TTSが動く
- [ ] 再読み込みとSPAによる画面遷移後も動く
- [ ] ブラウザを再起動した後も設定が残る

## テストで証明できる範囲

- ビルドの成功だけでは、Firefox Sidebarを実際に操作できることを証明できない
- 一時的な導入では、ブラウザ再起動後の永続性を検証できない
- プロバイダーを模したテストでは、実際のエンドポイントにおけるCSP、認証、モデルの提供状態を検証できない
- 実際のAPIキーで確認できないプロバイダーは、未実施として記録する
