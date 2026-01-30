# CR_ledger Database Schema

## Overview

CR_ledger は Clash Royale 公式 API の battlelog（Ranked / Trophy）を元に、
特定プレイヤー向けに「自分 × このデッキ × この環境」の傾向を把握するための
**分析補助用データベース**である。

本スキーマは以下の前提で設計されている：

- 少人数ユーザ・少〜中規模データ
- 無料枠前提（Cloudflare Workers + D1 / SQLite）
- 正解を断定しない分析（意思決定補助）
- プレイングではなくデッキ構成最適化が目的
- 例外が多いカード仕様は固定カラム化しない

---

## Tables

### players
対象プレイヤー（少人数想定）。

| column | type | note |
|------|------|------|
| player_tag | TEXT PK | プレイヤータグ |
| player_name | TEXT | 表示名（任意） |

---

### battles
対戦ログの主軸テーブル。

| column | type | note |
|------|------|------|
| battle_id | TEXT PK | battlelog 由来ID |
| player_tag | TEXT | 対象プレイヤー |
| battle_time | TEXT | ISO8601想定 |
| result | TEXT | win / loss / draw |
| my_deck_key | TEXT | 自分のデッキ |
| arena_id | INTEGER | 任意 |
| game_mode_id | INTEGER | 任意 |

※ `player_tag` / `my_deck_key` は論理的参照のみ（FK未宣言）。

---

### battle_opponent_cards
相手デッキを 8 行方式で保持。

| column | type | note |
|------|------|------|
| battle_id | TEXT PK | battles 参照 |
| slot | INTEGER PK | 0–9 |
| card_id | INTEGER | カードID |
| slot_kind | TEXT | normal / evolution / hero / support |

---

### my_decks
分析対象として登録した自分のデッキ。

| column | type | note |
|------|------|------|
| my_deck_key | TEXT PK | デッキ識別子 |
| player_tag | TEXT | 所有者 |
| deck_name | TEXT | 任意 |

---

### my_deck_cards
自分のデッキ構成（8 行方式）。

| column | type | note |
|------|------|------|
| my_deck_key | TEXT PK | my_decks 参照 |
| slot | INTEGER PK | 0–9 |
| card_id | INTEGER | カードID |
| slot_kind | TEXT | normal / evolution / hero / support |

---

### card_traits
カードの **固定・客観・ゲームシステム由来**の特性。

| column | type | note |
|------|------|------|
| card_id | INTEGER PK | 公式カードID |
| card_name | TEXT | 手入力補助 |
| card_type | TEXT | unit / spell / building / support |
| is_air | INTEGER | 0/1 |
| can_damage_air | INTEGER | 0/1 |
| primary_target_buildings | INTEGER | 0/1 |
| is_aoe | INTEGER | 0/1 |
| is_swarm_like | INTEGER | 0/1 |

※ 条件付き・意見が入りうる特性はここに含めない。

---

### trait_keys
副次特性の辞書テーブル。

| column | type | note |
|------|------|------|
| trait_key | TEXT PK | trait 識別子 |
| description | TEXT | 任意 |

---

### card_trait_kv
カードの副次特性（例外・条件付き特性）。

| column | type | note |
|------|------|------|
| card_id | INTEGER PK | 論理的に card_traits |
| slot_kind | TEXT PK | all / normal / evolution / hero / support |
| trait_key | TEXT PK | trait_keys 参照 |
| trait_value | TEXT | 任意の値 |

---

### card_classes
公式分類を軽く扱うための補助テーブル。

| column | type | note |
|------|------|------|
| card_id | INTEGER PK | card_traits 参照 |
| class_key | TEXT PK | CHECK で固定 |

class_key の許容値：
- tank
- anti_air
- distraction
- damage_spells
- win_condition
- second_spell
- mini_tank
- anti_tank
- random_card
- buildings

---

## Indexes

インデックスは以下を主目的として設計されている：

- プレイヤー × 期間
- プレイヤー × デッキ
- 出現カード起点の集計
- boolean trait による絞り込み

詳細は DDL を参照。

---

## PRAGMA results

以下の情報は **後から追記**する：

- PRAGMA table_info(...)
- PRAGMA foreign_key_list(...)
- PRAGMA index_list(...)

👉 貼り付け場所  
このファイルの末尾に、以下のようなセクションを追加する。

## PRAGMA: table_info

### battles
<ここに PRAGMA table_info(battles) の結果>

### card_traits
<ここに PRAGMA table_info(card_traits) の結果>
