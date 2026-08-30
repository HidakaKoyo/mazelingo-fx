# 0002 FirefoxではSidebar APIを使う

## 背景

操作UIは、Chrome Side Panelを前提としていました。
Firefoxの生成物には`side_panel`と`sidePanel`を出力できませんが、FirefoxにはSidebar APIがあります。
UI本体はブラウザに依存しません。

## 決定

Firefoxのmanifestには`sidebar_action`を生成します。
ツールバーの操作から`browser.sidebarAction.open()`を呼び、共通UIを開きます。
Chromeでは、`side_panel`と`browser.sidePanel.open({ tabId })`を維持します。

## 理由

各ブラウザの標準UIとAPIを使いながら、`entrypoints/sidepanel/`を共有できます。
Firefoxの生成物へChrome固有の権限を含める必要もありません。

## 影響

- Firefox Sidebarはウィンドウ側、Chrome Side Panelはタブ指定というライフサイクルの差が残る
- Firefoxでは利用者の操作から直接Sidebarを開き、ページ内の文法解説要求からは自動で開かない
- manifestとパネルを開くAPIを対象ごとに検証する
- 通常版Firefoxへの恒久導入には、Mozillaが署名したXPIが必要になる
- ウィンドウとタブの切り替え、再読み込み、再起動を手動で確認する
