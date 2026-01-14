export type SlotKind = "normal" | "evolution" | "hero" | "support";

export type ApiBaseOk = { ok: true };

export type PlayersResponse = ApiBaseOk & {
  players: Array<{
    player_tag: string;
    player_name: string;
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
