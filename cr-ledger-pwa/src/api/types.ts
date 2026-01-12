// src/api/types.ts

export type SlotKind = "normal" | "evolution" | "hero" | "support";

export type ApiBaseOk = {
  ok: boolean;
};

export type SyncResponse = ApiBaseOk & {
  synced: {
    total_fetched: number;
    upserted: number;
    skipped: number;
    skipped_non_target: number;
    skipped_other: number;
    stopped_early: number; // 0/1
  };
  results: Array<
    | {
        status: "upserted";
        battle_id: string;
        my_deck_key: string;
      }
    | {
        status: "skipped";
        reason: string;
        battle_id: string;
      }
  >;
};

export type MyDecksResponse = ApiBaseOk & {
  filter: { last: number };
  total_battles: number;
  decks: Array<{
    my_deck_key: string;
    deck_name: string | null;
    battles: number;
  }>;
};

export type OpponentTrendResponse = ApiBaseOk & {
  filter: { last?: number; since?: string };
  total_battles: number;
  cards: Array<{
    card_id: number;
    slot_kind: SlotKind;
    battles: number;
    usage_rate: number; // 0-1
  }>;
};

export type MatchupByCardResponse = ApiBaseOk & {
  my_deck_key: string;
  filter: { last: number; min: number };
  total_battles: number;
  cards: Array<{
    card_id: number;
    slot_kind: SlotKind;
    battles: number;
    wins: number;
    losses: number;
    win_rate: number; // 0-1
  }>;
};

export type PriorityResponse = ApiBaseOk & {
  my_deck_key: string;
  filter: { last: number; min: number };
  total_battles: number;
  cards: Array<{
    card_id: number;
    slot_kind: SlotKind;
    battles_with_card: number;
    usage_rate: number; // 0-1
    win_rate: number;   // 0-1
    priority_score: number;
  }>;
};


// ---- RoyaleAPI proxy cards ----

export type RoyaleApiCardItem = {
  name: string;
  id: number;
  maxLevel: number;
  maxEvolutionLevel?: number;
  elixirCost?: number;
  rarity?: string;
  iconUrls: {
    medium?: string;
    evolutionMedium?: string;
    heroMedium?: string;
  };
};

export type RoyaleApiSupportItem = {
  name: string;
  id: number;
  maxLevel: number;
  rarity?: string;
  iconUrls: {
    medium?: string;
  };
};

export type RoyaleApiCardsResponse = {
  items: RoyaleApiCardItem[];
  supportItems: RoyaleApiSupportItem[];
};
