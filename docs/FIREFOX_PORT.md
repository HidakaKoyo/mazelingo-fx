# Firefox移植

WXTのmulti-browser buildと共通UI、background、content script、storage、LLM処理を再利用します。Chrome固有APIをFirefox生成物へ出さず、panel操作だけをbrowser adapterへ隔離します。

## API対応表

| Chrome                              | Firefox                                 | 対応方法                         | 制約                                         |
| ----------------------------------- | --------------------------------------- | -------------------------------- | -------------------------------------------- |
| manifest `side_panel.default_path`  | manifest `sidebar_action.default_panel` | WXT configでtarget別生成         | key名と入れ子が異なる                        |
| permission `sidePanel`              | 追加permission不要                      | target別permission               | Firefoxへ`sidePanel`を出さない               |
| `browser.sidePanel.open({ tabId })` | `browser.sidebarAction.open()`          | `utils/browser-actions.ts`に集約 | Chromeはtab単位、Firefox Sidebarはwindow側UI |
| toolbar `action.onClicked`          | toolbar `action.onClicked`              | 共通listenerからadapterを呼ぶ    | Firefoxはuser gestureに直接続ける            |
| `background.service_worker`         | `background.scripts`                    | WXTのMV3 buildに委ねる           | 永続状態はstorageへ置く                      |
| `chrome.storage.local`              | `browser.storage.local`                 | `wxt/browser`を共通利用          | API keyは平文保存                            |

## Manifest確認

```bash
npm run build:firefox
npm run build:chrome
grep -E 'side_panel|sidePanel' .output/firefox-mv3/manifest.json
grep -E 'sidebar_action|sidebarAction' .output/chrome-mv3/manifest.json
```

上のgrepはどちらも0件が期待値です。必要なFirefox Sidebar / Chrome Side Panel key自体は各manifestを直接確認します。

Firefox manifestは現在、extension ID、Firefox 140以上、AMOのdata collection declaration（`authenticationInfo`と`websiteContent`）も明示します。API keyと翻訳対象textを扱う実装に合わせた宣言であり、機能や送信dataを変えた場合は同時に見直します。

## Sidebar lifecycle

toolbar iconで現在のbrowser用adapterがpanelを開きます。UI本体は`entrypoints/sidepanel/`を共有します。Firefox Sidebarはwindowに属し、Chrome Side Panelのopenは`tabId`を受け取る差があります。window / tab切り替え、開閉、extension reload、browser restartをmanual testします。backgroundは停止・再生成され得るため、memoryだけを永続状態にしません。

## Networkingと権限

LLMとTTSのfetchはbackgroundからproviderへ直接行います。FirefoxでCSP、CORS、host permissionによる失敗がないことをproviderごとに確認します。権限追加時は必要最小限かをreviewします。API keyをconsoleへ出さず、error本文にも混入させないことを維持します。

## 配布上の制約

通常版Firefoxへ恒久installするにはMozilla署名済みXPIが必要です。`wxt build -b firefox`の成功だけでは配布可能になりません。未署名buildは`about:debugging`からtemporary installします。これはFirefox終了時に解除されます。

## API変更時の確認箇所

1. WXT configのtarget別manifest
2. `utils/browser-actions.ts`のAPI呼び出し
3. `entrypoints/background/`のtoolbar action listener
4. `.output/*/manifest.json`
5. `docs/TESTING.md`のSidebar lifecycle項目
