# Firefox移植

Mazelingo-FXはFirefox Desktop 140以降を正式に配布、動作保証、サポートする下流プロジェクトです。
WXTによる複数ブラウザ向けのビルドと、共通のUI、バックグラウンド処理、コンテンツスクリプト、保存処理、LLM処理を再利用します。Chrome固有のAPIをFirefox生成物へ含めず、Chromium向け生成物は上流追従のソース互換性確認としてのみ扱います。

## ブラウザAPIの対応関係

FirefoxとChromeでは、パネルを定義して開くAPIが異なります。

| Chrome                              | Firefox                                 | 対応方法                         | 制約                                        |
| ----------------------------------- | --------------------------------------- | -------------------------------- | ------------------------------------------- |
| manifest `side_panel.default_path`  | manifest `sidebar_action.default_panel` | WXTの設定で対象別に生成          | キー名と入れ子が異なる                      |
| 権限`sidePanel`                     | 追加権限なし                            | 対象別に権限を指定               | Firefoxへ`sidePanel`を出力しない            |
| `browser.sidePanel.open({ tabId })` | `browser.sidebarAction.open()`          | `utils/browser-actions.ts`へ集約 | Chromeはタブ単位、Firefoxはウィンドウ側のUI |
| ツールバーの`action.onClicked`      | ツールバーの`action.onClicked`          | 共通listenerからアダプターを呼ぶ | Firefoxは利用者の操作から直接呼ぶ必要がある |
| `background.service_worker`         | `background.scripts`                    | WXTのManifest V3ビルドに任せる   | 永続化する状態はローカルストレージへ置く    |
| `chrome.storage.local`              | `browser.storage.local`                 | `wxt/browser`を共通で使う        | APIキーは平文で保存する                     |

この表のChrome列は、Mazelingo-FXがChrome利用者への動作保証をすることを意味しません。Chromiumビルドは、共通処理へFirefox固有の分岐を混入させていないことを確認する内部検査です。

## 生成したmanifestを確認する

```bash
npm run build:firefox
npm run build:chrome
grep -E 'side_panel|sidePanel' .output/firefox-mv3/manifest.json
grep -E 'sidebar_action|sidebarAction' .output/chrome-mv3/manifest.json
```

上の二つの`grep`は、どちらも0件になることが期待値です。
必要なFirefox SidebarとChrome Side Panelのキーは、それぞれのmanifestを直接確認します。

Firefoxのmanifestには、拡張機能ID、Firefox 140以降という条件、AMO向けのデータ収集宣言を明示します。
データ収集宣言は、実際に外部へ送信するデータと一致させます。APIキー、翻訳対象テキスト、host permission、送信先を変えた場合は、manifest、[プライバシーポリシー](privacy-policy.md)、Firefoxの同意表示を同じPull Requestで見直します。文法解説では閲覧中のページURLを外部プロバイダーへ送信しません。

## Sidebarを開く条件

Firefoxの`sidebarAction.open()`は、利用者の操作を扱う処理から直接呼ぶ必要があります。
そのため、ツールバーのアイコンを押した場合だけ、Firefox Sidebarを自動で開きます。
ページ内から文法解説を要求した場合は、要求内容を保存して既存のSidebarへ通知しますが、Sidebar自体は自動で開きません。
Chromeでは、同じ文法解説の要求からSide Panelを開けます。

UI本体は`entrypoints/sidepanel/`で共有します。
Firefox Sidebarはウィンドウに属し、Chrome Side Panelは`tabId`を受け取る点が異なります。
ウィンドウとタブの切り替え、開閉、拡張機能の再読み込み、ブラウザの再起動を手動で確認します。
バックグラウンド処理は停止、再生成される可能性があるため、メモリ上の状態だけに永続データを置きません。

## 通信と権限を確認する

LLMとTTSへの要求は、バックグラウンド処理から各プロバイダーへ直接送信します。
Firefoxでは、CSP、CORS、ホスト権限による失敗がないことをプロバイダーごとに確認します。
権限を追加する場合は、機能に必要な最小範囲かを確認します。
APIキーをコンソールへ出力せず、エラー本文に含めないこともテストとレビューで確認します。

## 通常版Firefoxへの配布には署名が必要

通常版Firefoxへ恒久導入するには、Mozillaが署名したXPIが必要です。
`wxt build -b firefox`の成功だけでは、配布可能な状態になりません。
未署名のビルドは、`about:debugging`から一時的に導入します。
一時的に導入した拡張機能は、Firefoxの終了時に解除されます。

## ブラウザAPIを変更したときの確認箇所

ブラウザAPIを変更した場合は、次の場所と生成物を確認します。

1. WXTの設定にある対象別のmanifest
2. `utils/browser-actions.ts`のAPI呼び出し
3. `entrypoints/background/`にあるツールバー操作のlistener
4. `.output/*/manifest.json`
5. `docs/TESTING.md`にあるSidebarの動作確認項目

Firefoxを正式リリースするためには、Firefox package検査、Firefox runtime smoke、署名済みXPIのrelease acceptanceをそれぞれ通す必要があります。詳細は[テスト](TESTING.md)と[リリース手順](RELEASING.md)を参照してください。
