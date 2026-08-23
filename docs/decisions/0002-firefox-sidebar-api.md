# 0002: FirefoxではSidebar APIを使う

## Context

操作UIはChrome Side Panelを前提としていた。Firefoxへ`side_panel` / `sidePanel`を出力できず、FirefoxにはSidebar APIがある。UI本体はbrowser非依存である。

## Decision

Firefox manifestには`sidebar_action`を生成し、toolbar actionから`browser.sidebarAction.open()`で共通UIを開く。Chromeは`side_panel`と`browser.sidePanel.open({ tabId })`を維持する。

## Reason

各browserの標準UIとAPIを使いながら`entrypoints/sidepanel/`を共有し、FirefoxへChrome固有permissionを出さずに済む。

## Consequences

- Firefox Sidebarはwindow側、Chrome Side Panelはtab指定というlifecycle差が残る
- manifestとopen APIをtargetごとに検証する
- Firefox通常版への恒久installにはMozilla署名済みXPIが必要
- window / tab切り替え、reload、restartをmanual testする
