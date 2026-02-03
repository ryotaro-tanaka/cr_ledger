# CR_ledger Database Schema

## Overview

CR_ledger は Clash Royale 公式 API の battlelog（Ranked / Trophy）を元に、
特定プレイヤー向けに「自分 × このデッキ × この環境」の傾向を把握するための
分析補助用データベースである。

本スキーマは以下の前提で設計されている。

- 少人数ユーザ・少〜中規模データ
- 無料枠前提（Cloudflare Workers + D1 / SQLite）
- 正解を断定しない分析（意思決定補助）
- プレイングではなくデッキ構成最適化が目的
- 例外が多いカード仕様は固定カラム化しない

## Tables

### players
分析対象となるプレイヤー。

| column | type | note |
|------|------|------|
| player_tag | TEXT PK | プレイヤータグ |
| player_name | TEXT | 表示名（任意） |

### battles
対戦ログの主軸テーブル。

| column | type | note |
|------|------|------|
| battle_id | TEXT PK | battlelog 由来ID |
| player_tag | TEXT | players.player_tag を参照 |
| battle_time | TEXT | ISO8601（UTC） |
| result | TEXT | win / loss / draw |
| my_deck_key | TEXT | 使用デッキ識別子 |

制約・参照：
- FOREIGN KEY (player_tag) REFERENCES players(player_tag)

### battle_opponent_cards
相手デッキを 8〜9 行方式で保持。

| column | type | note |
|------|------|------|
| battle_id | TEXT PK | battles.battle_id を参照 |
| slot | INTEGER PK | 0–9 |
| card_id | INTEGER | カードID |
| slot_kind | TEXT | normal / evolution / hero / support |

制約・参照：
- FOREIGN KEY (battle_id) REFERENCES battles(battle_id)

### my_decks
分析対象として登録した自分のデッキ。

| column | type | note |
|------|------|------|
| my_deck_key | TEXT PK | デッキ識別子 |
| player_tag | TEXT | players.player_tag を参照 |
| deck_name | TEXT | 任意 |

制約・参照：
- FOREIGN KEY (player_tag) REFERENCES players(player_tag)

### my_deck_cards
自分のデッキ構成（8〜9 行方式）。

| column | type | note |
|------|------|------|
| my_deck_key | TEXT PK | my_decks.my_deck_key を参照 |
| slot | INTEGER PK | 0–9 |
| card_id | INTEGER | カードID |
| slot_kind | TEXT | normal / evolution / hero / support |

制約・参照：
- FOREIGN KEY (my_deck_key) REFERENCES my_decks(my_deck_key)

### card_traits
カードの固定・客観・ゲームシステム由来の特性。

| column | type | note |
|------|------|------|
| card_id | INTEGER PK | 公式カードID |
| card_name | TEXT | 手入力補助（任意） |
| card_type | TEXT | unit / spell / building / support |
| is_air | INTEGER | 0 / 1 |
| can_damage_air | INTEGER | 0 / 1 |
| primary_target_buildings | INTEGER | 0 / 1 |
| is_aoe | INTEGER | 0 / 1 |
| is_swarm_like | INTEGER | 0 / 1 |

※ 条件付き・評価が分かれうる特性は含めない。

### trait_keys
副次特性の辞書テーブル。

| column | type | note |
|------|------|------|
| trait_key | TEXT PK | trait 識別子 |
| description | TEXT | 説明（任意） |

### card_trait_kv
カードの副次特性（例外・条件付き特性）。

| column | type | note |
|------|------|------|
| card_id | INTEGER PK | card_traits.card_id を参照 |
| slot_kind | TEXT PK | all / normal / evolution / hero / support |
| trait_key | TEXT PK | trait_keys.trait_key を参照 |
| trait_value | INTEGER NULL | 強度（0–100）。NULL は存在のみ |

制約・参照：
- FOREIGN KEY (card_id) REFERENCES card_traits(card_id)
- FOREIGN KEY (trait_key) REFERENCES trait_keys(trait_key)

### card_classes
公式分類を軽く扱うための補助テーブル。

| column | type | note |
|------|------|------|
| card_id | INTEGER PK | card_traits.card_id を参照 |
| class_key | TEXT PK | 固定分類キー |

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

### seasons
シーズン境界を記録するためのテーブル。

| column | type | note |
|------|------|------|
| start_time | TEXT PK | シーズン開始時刻（UTC） |

※ 現時点では他テーブルとの外部キー関係は持たない。
