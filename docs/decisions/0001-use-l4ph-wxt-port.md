# 0001 L4Ph版のWXT移行を技術的な基盤にする

## 背景

Yeq6X/mazelingoは正式なupstreamですが、Firefox版を継続して保守するには、ブラウザ別のビルド、TypeScript、テスト可能なモジュール分割が必要でした。
L4Phの`feature/wxt-typescript-migration`は、同じupstream履歴上でTypeScriptとWXTへの移行、エントリーポイントの再構成、Vitest、Playwright、lint、CIを実装していました。

## 決定

Yeq6X upstreamの`6b91045`から作業ブランチを作り、L4Phのコミット`ddd6342`をfast-forwardで取り込みます。
正式なupstreamはYeq6X版とし、L4Ph版は別のリモートとして保持します。

## 理由

共通祖先上のコミットとして取り込めるため、ファイルを複製するより実装の由来を追跡しやすくなります。
WXTによる複数ブラウザ向けのビルドとテストを、Firefox移植へ再利用できます。

## 影響

- L4Ph版に由来することをREADME、`UPSTREAM.md`、Git履歴へ残す
- Yeq6X版の変更は、現在のTypeScript構成へ内容を確認しながら移植する
- L4Ph版の将来の変更はupstreamとして自動追従せず、差分ごとに採用を決める
- WXT移行に由来する不具合もMazelingo-FXで保守する
