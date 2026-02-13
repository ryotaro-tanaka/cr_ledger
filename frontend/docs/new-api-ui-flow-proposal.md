# New API 対応 UI遷移案（frontend/src 現状整理つき）

## 1. 現状の画面構成（frontend/src）

- ルーティングは `Home / Priority / Matchup / Trend / Settings` の5画面。
- `player` と `deckKey` 未選択時は `RequireSelection` で `Settings` へリダイレクト。
- 設定系は `Settings` 画面に集約され、`Players` と `Decks` を同一画面で選択。
- `Home` は `Sync` 実行と、Priority/Matchup/Trend へのプレビュー導線を担う。
- `Priority` / `Matchup` は「選択中デッキ」に紐づく分析を表示。
- `Trend` は「プレイヤー」に紐づく分析で、デッキ依存ではない。

## 2. 新APIへの読み替え

※ 前提: **Trendは旧API時代から一貫して「プレイヤー紐づき（デッキ非依存）」**。
  今回の改修でもこのドメイン前提は変わらない。

想定される責務を以下で分離するのが自然。

- 共通（選択・同期）
  - `GET /api/common/players`
  - `PATCH /api/common/my-decks/name`
  - `POST /api/common/sync`
  - `GET /api/common/cards`
- デッキ固有（選択中デッキ）
  - `GET /api/decks/{my_deck_key}/summary`
  - `GET /api/decks/{my_deck_key}/offense/counters`
  - `GET /api/decks/{my_deck_key}/defense/threats`
- プレイヤー固有（デッキ非依存）
  - `GET /api/trend/{player_tag}/traits`

## 3. 推奨情報設計（IA）

Trendは「新しくデッキ非依存になった」のではなく、
**もともとデッキ非依存だった性質をUI上でより明示する**方針。

### 結論

- **Settings画面は踏襲**してよい。
- ただし Home を「集約トップ」ではなく **Deck Overview（選択デッキのハブ）** として再定義するのがよい。
- 画面は以下4系統に整理すると、ユーザ動線とAPI責務が一致しやすい。

1. `Settings`（プレイヤー選択＋デッキ選択＋デッキ名変更）
2. `Deck Summary`（旧Homeの後継、選択デッキの要約＋同期）
3. `Offense Counters`（選択デッキの攻撃時に刺さるTrait/Card）
4. `Defense Threats`（選択デッキの防衛時に脅威なTrait/Card）
5. `Trend Traits`（プレイヤー全体の環境トレンド、デッキ非依存）

## 4. 推奨画面遷移（ユーザ動線）

```text
初回起動
  -> Settings
      1) Player選択
      2) Deck選択（必要なら名前編集）
  -> Deck Summary（default landing）
      3) サマリー確認
      4) 必要時 Sync now
      5) 深掘り: Offense / Defense / Trend へ遷移
```

### BottomNavの推奨

- `Summary`
- `Offense`
- `Defense`
- `Trend`
- `Settings`

※ `Trend` だけ deckKey を必須にしない（player のみ必須）設計が重要。

## 5. UX上の重要ポイント

1. **Selection状態を常時表示**
   - 画面上部に `Player / Deck` の現在値をチップ表示。
   - Trend では「Deckに依存しない」注記を出す。

2. **Syncの配置**
   - メインは `Deck Summary` に配置。
   - 必要なら全画面共通ヘッダに小型Syncアクションを追加。

3. **空状態メッセージの明確化**
   - Offense/Defense は「デッキ未選択」
   - Trend は「プレイヤー未選択」

4. **遷移時の違和感削減**
   - Player変更時は deckKey をクリア。
   - Deck変更時は Summary に戻す（または現在ページで再フェッチ）。

## 6. 段階的移行案（実装順）

1. APIクライアントを新エンドポイントへ差し替え。
2. Homeを `Deck Summary` として再実装。
3. Priority/Matchup を `Offense/Defense` ページへ置換。
4. Trend を Traits表示へ置換。
5. BottomNavと文言を新ドメインに更新。

---

この構成にすると、
- 「デッキに紐づく分析」(Summary/Offense/Defense)
- 「プレイヤーに紐づく環境分析」(Trend)

がUI上でも明確に分離され、ユーザが迷いにくくなる。


## 7. データ取得戦略（players先行 + summary補完）

ご提示の導線（`GET /api/common/players` を最初に実行し、特定画面遷移時に `GET /api/decks/{my_deck_key}/summary` で補完）は、
**初期表示速度と詳細データの鮮度を両立できる**ため、かなり良い設計。

### 推奨: React Query + Selection Context

- **React Query（TanStack Query）を採用推奨**
  - `players` をアプリ共通キャッシュに保持
  - `deck summary` を `my_deck_key` 単位で遅延取得（on-demand）
  - 画面戻り時の再利用、バックグラウンド再検証、重複リクエスト抑制が簡単
- **Contextは最小限**（状態のみ）
  - `selectedPlayerTag`, `selectedDeckKey` の選択状態だけを Context/localStorage で保持
  - サーバーデータ本体（players/summary/counters/threats/trend）は Query に寄せる

## 8. 実装イメージ（キー設計）

### Query keys

- `['players', { last }]` -> `GET /api/common/players`
- `['deckSummary', myDeckKey]` -> `GET /api/decks/{my_deck_key}/summary`
- `['deckOffenseCounters', myDeckKey]` -> `GET /api/decks/{my_deck_key}/offense/counters`
- `['deckDefenseThreats', myDeckKey]` -> `GET /api/decks/{my_deck_key}/defense/threats`
- `['trendTraits', playerTag]` -> `GET /api/trend/{player_tag}/traits`

### 取得タイミング

1. アプリ起動時に `players` をprefetch（またはSettings初回表示時にfetch）
2. ユーザがデッキ選択
3. `Deck Summary` へ遷移時に `deckSummary` をfetch
4. 体感改善のため、選択直後に `deckSummary` を prefetch しておくのも有効

### 補足ロジック（表示側）

- `players` に含まれる `decks/cards` は「一覧・選択用のベース情報」として使う
- `deckSummary` は「分析用メタ情報（traits/classes/card attributes）」として上書き補完
- UIは `base(players)` + `detail(summary)` のマージで表示

## 9. 判断ポイント（React Queryを使うべきか）

この要件では、以下が当てはまるため **使う価値が高い**。

- 同じデータを複数画面から参照する（Settings / Summary / Offense / Defense）
- キー付きで再取得したい（`playerTag`, `myDeckKey`）
- `sync` 後に関連データをまとめて再検証したい（`invalidateQueries`）

一方で、Contextだけで全APIレスポンスを持つ設計は、
- キャッシュ無効化
- 並列リクエスト
- ローディング/エラー一貫性

を自前実装しがちなので、将来の変更コストが上がりやすい。

---

要約すると、
- **Selection（選択状態）**: Context
- **Server state（API結果）**: React Query

の分離が、今回のAPI構成と最も相性がよい。
