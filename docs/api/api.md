# API仕様 (CR_ledger) — Legacy

このドキュメントは Cloudflare Worker が公開する現在の HTTP API を説明します。
ここに記載されるエンドポイントはすべて「レガシー」であり、現行クライアント互換のために残しているものです。将来的に新しい API に置き換える予定です。

本書は、(1) 提供された現行レスポンス例、(2) 旧 api.md の説明、の両方から確認できた内容のみをまとめています。サンプルが無い項目や挙動は本書では記載していません。

## Base URL

https://cr-ledger.ryotaro-tanaka.workers.dev

## 認証

（CORS の preflight を除き）すべてのリクエストで Bearer トークンが必要です。

例:

Authorization: Bearer <CR_LEDGER_AUTH>

- トークンがない / 不正な場合: 401
- サーバ設定不備（トークン未設定など）: 500

## 共通仕様

- レスポンスは原則 JSON（例外: GET / は text/plain）。
- すべてのエンドポイントで CORS が有効。
- OPTIONS は 204 を返し、CORS ヘッダを含む。
- 成功時レスポンスには原則 `ok: true` を含む。
  - `ok: false` の構造はサンプル未提示のため本書では規定していません。

## データ型（参照）

- player_tag
  - プレイヤータグ（先頭 `#` はあってもなくても可とされるエンドポイントがあります）

- my_deck_key
  - 形式: `{player_tag}::{card_id}:{slot_kind}|{card_id}:{slot_kind}|...`
  - 例:

    GYVCJJCR0::26000010:normal|26000014:hero|26000058:evolution|...|159000000:support

- slot_kind
  - 値: `normal` / `evolution` / `hero` / `support`

---

# エンドポイント

### GET /

- 説明: 利用可能なエンドポイント例を text/plain で返します。
- 備考: このルート（GET /）はレガシーではなく現行エンドポイントとして継続運用されます。
- 認証: Required（preflight を除く）
- レスポンス: `200 text/plain`

---

# レガシーエンドポイント

レガシー扱いの API 仕様は別ファイルに分割しました。詳細は以下を参照してください。

- [docs/api/legacy.md](docs/api/legacy.md)

