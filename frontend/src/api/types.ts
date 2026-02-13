export type SlotKind = "normal" | "evolution" | "hero" | "support";

export type ApiBaseOk = { ok: true };

export type PlayersResponse = ApiBaseOk & {
  filter: { last: number };
  players: Array<{
    player_tag: string;
    player_name: string;
    total_battles: number;
    decks: Array<{
      my_deck_key: string;
      deck_name: string | null;
      battles: number;
      cards: Array<{
        slot: number;
        card_id: number;
        slot_kind: SlotKind;
      }>;
    }>;
  }>;
};

export type SyncResponse = ApiBaseOk & {
  synced?: {
    total_fetched: number;
    upserted: number;
    skipped: number;
    skipped_non_target?: number;
    skipped_other?: number;
    stopped_early?: number;
  };
  results?: Array<
    | { status: "upserted"; battle_id: string; my_deck_key: string }
    | { status: "skipped"; reason: string; battle_id: string }
  >;
};

export type MyDecksResponse = ApiBaseOk & {
  filter: { player_tag: string; last: number };
  total_battles: number;
  decks: Array<{
    my_deck_key: string;
    deck_name: string | null;
    battles: number;
  }>;
};

export type OpponentTrendResponse = ApiBaseOk & {
  filter: { player_tag: string } & ({ last: number } | { since: string });
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
  filter: { last: number; player_tag: string };
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
  filter: { player_tag: string; last: number };
  total_battles: number;
  cards: Array<{
    card_id: number;
    slot_kind: SlotKind;
    deck_battles_with_card: number;
    usage_rate: number; // 0-1
    win_rate: number; // 0-1
    priority_score: number;
  }>;
};


export type RoyaleApiCardsResponse = {
  items: Array<{
    name: string;
    id: number;
    iconUrls?: { medium?: string; evolutionMedium?: string; heroMedium?: string };
  }>;
  supportItems: Array<{
    name: string;
    id: number;
    iconUrls?: { medium?: string };
  }>;
};

export type MyDeckCardsResponse = {
  ok: true;
  my_deck_key: string;
  cards: Array<{
    slot: number;
    card_id: number;
    slot_kind: SlotKind;
  }>;
};

export type DeckSummaryResponse = ApiBaseOk & {
  deck_traits: Array<{
    trait_key: string;
    count: number;
  }>;
  deck_classes: Array<{
    class_key: string;
    count: number;
  }>;
  cards: Array<{
    card_id: number;
    slot_kind: SlotKind;
    card_type: "unit" | "spell" | "building" | "support";
    card_traits: string[];
    classes: string[];
  }>;
};

type ImpactStats = {
  battles_with_element: number;
  encounter_rate: number;
  win_rate_given: number;
  delta_vs_baseline: number;
  threat_score: number;
};

export type DeckOffenseCountersResponse = ApiBaseOk & {
  filter: { seasons: number };
  summary: {
    total_battles: number;
    baseline_win_rate: number;
    win_condition_cards: Array<{ card_id: number; slot_kind: SlotKind }>;
  };
  counters: {
    cards: Array<{ card_id: number; slot_kind: SlotKind; stats: ImpactStats }>;
    traits: Array<{ trait_key: string; description: string | null; stats: ImpactStats }>;
  };
};

export type DeckDefenseThreatsResponse = ApiBaseOk & {
  filter: { seasons: number };
  summary: {
    total_battles: number;
    baseline_win_rate: number;
  };
  threats: Array<{ card_id: number; slot_kind: SlotKind; stats: ImpactStats }>;
};

export type TrendTraitsResponse = ApiBaseOk & {
  filter: { seasons: number };
  total_battles: number;
  deck_size: number;
  traits: Array<{
    trait_key: string;
    distribution: Array<{ count: number; battles: number; rate: number }>;
    summary: { mean_count: number; rate_ge_2: number };
  }>;
};
