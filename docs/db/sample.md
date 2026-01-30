# Sample Data (CR_ledger)

このファイルは、CR_ledger の DB スキーマ理解を補助するために、
各テーブルの **実データ例（最大5行）** を CSV 形式で記載したものです。

- データは `LIMIT 5` で取得しているため、順序は保証されません
- NULL 値は空欄で表現しています
- 実運用データの一部を含むため、公開時は内容を確認してください

---

## players

```csv
player_tag,player_name
GYVCJJCR0,tanakar
VLLCRRLLV,lia
RQ2JLG98P,らら
R0QVG90L9,あああ
G8YJJYCQR,ともや
```

---

## battles

```csv
battle_id,player_tag,battle_time,result,my_deck_key,arena_id,game_mode_id
GYVCJJCR0_YCCCQR98L_20260109T054508.000Z_pathOfLegend,GYVCJJCR0,20260109T054508.000Z,win,GYVCJJCR0::26000010:normal|26000014:evolution|26000058:normal|26000084:normal|26000097:normal|26000102:normal|27000010:evolution|28000026:normal|159000000:support,,
GYVCJJCR0_9C9RPQ9G9_20260110T000403.000Z_pathOfLegend,GYVCJJCR0,20260110T000403.000Z,loss,GYVCJJCR0::26000010:normal|26000014:hero|26000058:evolution|26000084:normal|26000097:normal|26000102:normal|27000010:evolution|28000026:normal|159000000:support,,
GYVCJJCR0_C2RYCY9GR_20260109T053435.000Z_pathOfLegend,GYVCJJCR0,20260109T053435.000Z,win,GYVCJJCR0::26000010:normal|26000014:normal|26000058:evolution|26000084:normal|26000097:normal|26000102:normal|27000010:evolution|28000026:normal|159000000:support,,
GYVCJJCR0_8PV90YRU2_20260109T052037.000Z_pathOfLegend,GYVCJJCR0,20260109T052037.000Z,loss,GYVCJJCR0::26000010:evolution|26000014:hero|26000058:evolution|26000084:normal|26000097:normal|26000102:normal|27000010:normal|28000026:normal|159000000:support,,
GYVCJJCR0_JU0GC0RR9_20260108T234828.000Z_pathOfLegend,GYVCJJCR0,20260108T234828.000Z,win,GYVCJJCR0::26000010:normal|26000014:hero|26000058:evolution|26000084:normal|26000097:normal|26000102:normal|27000010:evolution|28000026:normal|159000000:support,,
```

---

## battle_opponent_cards

```csv
battle_id,slot,card_id,slot_kind
GYVCJJCR0_9C9RPQ9G9_20260110T000403.000Z_pathOfLegend,0,26000012,evolution
GYVCJJCR0_9C9RPQ9G9_20260110T000403.000Z_pathOfLegend,1,28000004,evolution
GYVCJJCR0_9C9RPQ9G9_20260110T000403.000Z_pathOfLegend,2,26000011,normal
GYVCJJCR0_9C9RPQ9G9_20260110T000403.000Z_pathOfLegend,3,26000040,normal
GYVCJJCR0_9C9RPQ9G9_20260110T000403.000Z_pathOfLegend,4,28000011,normal
```

---

## my_decks

```csv
my_deck_key,player_tag,deck_name
GYVCJJCR0::26000010:normal|26000014:evolution|26000058:normal|26000084:normal|26000097:normal|26000102:normal|27000010:evolution|28000026:normal|159000000:support,GYVCJJCR0,
GYVCJJCR0::26000010:normal|26000014:hero|26000058:evolution|26000084:normal|26000097:normal|26000102:normal|27000010:evolution|28000026:normal|159000000:support,GYVCJJCR0,デフォルト
GYVCJJCR0::26000010:normal|26000014:normal|26000058:evolution|26000084:normal|26000097:normal|26000102:normal|27000010:evolution|28000026:normal|159000000:support,GYVCJJCR0,
GYVCJJCR0::26000010:evolution|26000014:hero|26000058:evolution|26000084:normal|26000097:normal|26000102:normal|27000010:normal|28000026:normal|159000000:support,GYVCJJCR0,
GYVCJJCR0::26000010:normal|26000014:hero|26000058:evolution|26000084:normal|26000097:normal|26000102:normal|27000010:evolution|28000026:normal|159000001:support,GYVCJJCR0,
```

---

## my_deck_cards

```csv
my_deck_key,slot,card_id,slot_kind
GYVCJJCR0::26000010:normal|26000014:evolution|26000058:normal|26000084:normal|26000097:normal|26000102:normal|27000010:evolution|28000026:normal|159000000:support,0,27000010,evolution
GYVCJJCR0::26000010:normal|26000014:evolution|26000058:normal|26000084:normal|26000097:normal|26000102:normal|27000010:evolution|28000026:normal|159000000:support,1,26000014,evolution
GYVCJJCR0::26000010:normal|26000014:evolution|26000058:normal|26000084:normal|26000097:normal|26000102:normal|27000010:evolution|28000026:normal|159000000:support,2,26000058,normal
GYVCJJCR0::26000010:normal|26000014:evolution|26000058:normal|26000084:normal|26000097:normal|26000102:normal|27000010:evolution|28000026:normal|159000000:support,3,26000102,normal
GYVCJJCR0::26000010:normal|26000014:evolution|26000058:normal|26000084:normal|26000097:normal|26000102:normal|27000010:evolution|28000026:normal|159000000:support,4,26000097,normal
```

---

## card_traits

```csv
card_id,card_name,card_type,is_air,can_damage_air,primary_target_buildings,is_aoe,is_swarm_like
26000000,Knight,unit,0,0,0,0,0
26000001,Archers,unit,0,1,0,0,0
26000002,Goblins,unit,0,0,0,0,1
26000003,Giant,unit,0,0,1,0,0
26000004,P.E.K.K.A,unit,0,0,0,0,0
```

---

## trait_keys

```csv
trait_key,description
stun,zap
slowdown,snow
inferno,
knockback_immune,
knockback,fireball
```

---

## card_trait_kv

```csv
card_id,slot_kind,trait_key,trait_value
28000008,all,stun,
```

---

## card_classes

```csv
card_id,class_key
26000000,tank
26000038,tank
26000032,tank
26000067,tank
26000011,tank
```
