# frontend/src PWA コードレビュー

実施日: 2026-02-13  
対象: `frontend/src/` 一式（React + TypeScript + Vite）

## 結論サマリ

- **ビルドは成功**しており、実装全体の構造も `pages / components / lib / api` に整理されていて読みやすいです。
- 一方で、**ESLint で 3 error + 1 warning** が出ており、うち1件は実バグ（Players のエラーハンドリング）です。
- 現時点の優先修正は以下です。
  1. `Players.tsx` の `catch` 条件ミスで API エラーが UI 表示されない不具合を修正。
  2. `api.ts` の `any` を具体型に変更し lint error を解消。
  3. `selection.tsx` の Context と Hook を分離し Fast Refresh 警告を解消。
  4. `Selected.tsx` の `useEffect` 依存配列を整理して将来の取りこぼしを防止。

---

## 実施したチェック

- `npm --prefix frontend run lint`
- `npm --prefix frontend run build`
- 主要ファイルの目視レビュー

---

## 指摘事項（重要度順）

## 1) [High] Players のエラーハンドリングが逆条件で実質無効

- 対象: `frontend/src/pages/settings/Players.tsx`
- `catch` 内が `if (!cancelled) return;` になっており、**通常時（cancelled=false）に即 return してしまう**ため、`setError(...)` が実行されません。
- その結果、`getPlayers()` 失敗時にユーザーへエラーが表示されない状態になります。

### 推奨修正

```ts
} catch (e) {
  if (cancelled) return;
  setError(toErrorText(e));
}
```

---

## 2) [Medium] API request の `any` 使用で型安全性が低下（lint error）

- 対象: `frontend/src/api/api.ts`
- `request<T>(..., opts?: { ... params?: Record<string, any>; body?: any })` となっており、`@typescript-eslint/no-explicit-any` に抵触。
- `body` や `params` の型が緩く、将来の API 変更でフロント側が型検知しにくくなります。

### 推奨修正

- 例:
  - `params?: Record<string, string | number | boolean | undefined>`
  - `body?: unknown`
- 可能ならエンドポイントごとの payload type を定義して `request` に渡す方針へ寄せる。

---

## 3) [Medium] `selection.tsx` の export 構成が Fast Refresh ルール違反

- 対象: `frontend/src/lib/selection.tsx`
- `SelectionProvider` と `useSelection` を同一ファイルで export しているため、`react-refresh/only-export-components` で error。
- 現状動作はしますが、開発体験（HMR の安定性）に影響する可能性があります。

### 推奨修正

- `SelectionProvider`（コンポーネント）と `useSelection`（Hook/utility）を分離。
  - 例: `selection-context.tsx` / `useSelection.ts`

---

## 4) [Low] `Selected.tsx` の `useEffect` 依存が不完全（warning）

- 対象: `frontend/src/pages/settings/Selected.tsx`
- 依存配列が `[player?.player_tag]` のみで、`player` オブジェクト自体は依存に入っていません。
- 現在の実装意図（tag 変化時のみ fetch）としては動作しますが、hook ルール警告が残りメンテ時に混乱を招きます。

### 推奨修正

- `playerTag` を先に変数化して依存を明示するか、lint コメント付きで意図を固定。

---

## 良い点

- 画面責務が明確で、`CardRow` や `SectionCard` など再利用コンポーネント化が進んでいる。
- `toErrorText` / `ApiErrorPanel` の導線が全体的に統一され、UI に一貫性がある。
- `useDeckCardsCache` でデッキごとのカード取得を分離しており、機能分割の方向性が良い。
- `build` は通っており、型レベルで致命的破綻は現時点でない。

---

## 優先対応プラン（短期）

1. **バグ修正**: `Players.tsx` の `catch` 条件を修正。  
2. **lint error 解消**: `api.ts` の `any` 排除、`selection` 分割。  
3. **lint warning 解消**: `Selected.tsx` の依存配列整理。  
4. `npm run lint` を CI の必須チェックへ組み込み（未導入なら）。

---

## 補足

- 本レビューはコードリーディング + lint/build 実行ベースです。
- 実機 PWA 動作（ホーム画面追加、standalone 判定、Service Worker 更新挙動）は別途 E2E 観点で確認推奨です。
