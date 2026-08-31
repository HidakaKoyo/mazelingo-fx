# ADR 0001: Firefox downstream として運用する

## 状態

採用

## 背景

Mazelingo-FX は upstream の機能進化を取り込みつつ、Firefox で安全に配布・保守する必要がある。Firefox と Chromium は拡張 API、manifest、配布・署名、実行時検証が一部異なる。一方、browser 共通機能まで独自化すると、upstream 取り込みとセキュリティ修正の保守負債が増える。

## 決定

- Firefox Desktop 140 以降を唯一の正式製品・配布・サポート対象とする。
- `Yeq6X/mazelingo` を唯一の通常 upstream とする。
- Chromium は非配布の build / manifest 互換性確認として維持する。成功しても Chromium の製品サポートを意味しない。
- Firefox 固有の差分を browser abstraction、Firefox manifest、Sidebar、AMO 配布、Firefox 検証へ局所化する。
- browser 共通の機能・修正は upstream への提案を優先する。
- upstream 同期は専用 branch と PR でレビューし、`main` への直接同期や自動同期を行わない。
- `main` は公開統合履歴として force-push しない。通常変更は squash merge、upstream の clean merge は merge commit を残す。

## 理由

上流を直接取り込みつつ最小限の下流差分を保つと、上流更新の確認範囲と Firefox 固有の責任範囲を分離できる。これは、下流が製品責任を持ちながら上流の進化を取り込む OSS の一般的な運用原則である。

本リポジトリは小規模であるため、Brave のような patch engine、複数の常設 release branch、Nightly / Beta / Stable の多段チャネルは採用しない。branch、PR、同期台帳、CI を使う軽量な運用で十分とする。

## 影響

- Firefox の runtime 検証と署名済みリリース検証を、Firefox リリースの品質条件として整備する。
- Chromium 向けの E2E は互換性・診断のために維持できるが、Firefox リリースの唯一の判定条件にはしない。
- 公開ドキュメント、CI、Issue / PR テンプレートは、このサポート範囲を明示する。
- upstream 同期では、完全統合済みの基点と判断済みの基点を `docs/upstream-state.json` で分け、採用・見送り、検証結果は同期 PR に残す。
