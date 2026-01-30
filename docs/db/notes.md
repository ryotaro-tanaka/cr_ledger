# Notes

- 実際に宣言されている FK のみを図示
- 論理的参照（FK未宣言）は線を弱めて表現
- 可読性優先のため battles 系と card 系を同一図にまとめている

---

## `/doc/db/notes.md`

```txt
# DB Design Notes (CR_ledger)

## 基本思想
- このDBは「分析補助」であり正解を出さない
- 勝率・傾向は常にサンプル数とセットで扱う
- Tier / Meta を直接モデル化しない

## card_traits / card_trait_kv の分離理由
- 固定・客観・仕様由来のみを card_traits に置く。
- 例外・条件付き・意見が入りうる要素は card_trait_kv に逃がす。
- 新仕様では trait_value を 0–100 の整数値で任意に保持でき、NULL は存在のみを示す。これにより「存在のみ」か「強度付き」かを扱いやすくする。
- 主キーは (card_id, slot_kind, trait_key) として一意性を担保し、trait_key は trait_keys を参照する外部キー制約がある。
- インデックスは実用的最小限（card_id / slot_kind / (trait_key, slot_kind)）を用意して検索性能を確保する。

## class の扱い
- class は公式分類だが信頼度は高くない
- 誤字防止のため CHECK のみ
- 分析の主軸には使わない

## FK を張っていない理由
- 運用上の柔軟性を優先
- 一部は論理的参照に留めている
- 将来必要なら再作成で追加可能

## 時刻の扱い
- battle_time は TEXT
- ISO8601 前提で範囲検索・並び替えを行う

## 将来変更しそうな点
- card_trait_kv.trait_value の NULL 許容
- battles への season / patch 情報の付与
- 共起分析用の集計テーブル追加（キャッシュ用途）

## やらないこと
- 環境 Tier の直接管理
- プレイング最適化ロジック
- 全ユーザ横断の統計
```

---

## 変更点メモ
- card_trait_kv テーブルの定義を更新し、trait_value の範囲制約と複合主キー・外部キーを明記しました。
- 必要に応じて PRAGMA 出力や DDL を追記してください。
