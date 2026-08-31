# Firefox リリース手順

Mazelingo-FX の正式リリースは Firefox Desktop 向け署名済み XPI です。Chromium build はリリース成果物ではありません。

## リリース前

1. `main` が最新の origin と一致し、作業ツリーに未コミット変更がないことを確認する。
2. [docs/TESTING.md](TESTING.md) の必須検証、Firefox build、manifest 検証、`web-ext lint` を通す。
3. Firefox のクリーンプロファイルで、Sidebar、翻訳、設定保存、background 通信を確認する。
4. UI、権限、送信データ、プライバシーポリシー、AMO のデータ収集申告に矛盾がないことを確認する。
5. upstream を取り込んだリリースでは、[docs/upstream-state.json](upstream-state.json) と同期 PR の記録を確認する。

## リリース

1. バージョンを更新し、リリースPRで検証結果と変更点を確認する。
2. `main` を merge した commit に `v<version>` の注釈付き tag を付ける。tag は書き換えない。
3. Firefox 用パッケージを build し、AMO の署名済み XPI を取得する。
4. 署名済み XPI をクリーンな Firefox プロファイルへ導入し、再起動後にも動作することを確認する。
5. GitHub Release を同じ tag から作り、署名済み XPI、変更点、既知の制約、対応 Firefox バージョンを記録する。

AMO listed 配布を正式な自動更新経路とする。unlisted XPI は検証または限定配布に使えるが、利用者への更新経路を別途用意しない限り正式リリースにはしない。
WXTが作るFirefox source ZIPには、`test-results/`と`playwright-report/`を含めない。診断結果を配布物やAMO提出物へ混ぜないためである。

## リリース後

- AMO の公開状態と公開されたバージョンを確認する。
- GitHub Release の tag、添付物、変更点が一致することを確認する。
- 利用者報告を [SUPPORT.md](../SUPPORT.md) の分類に従って triage する。

リリースを中止した場合は、作成済み tag や配布物を無言で置き換えない。理由と後継リリースの扱いを記録する。
