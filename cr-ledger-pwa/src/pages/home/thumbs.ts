import type { SlotKind } from "../../api/types";

export type Thumb = {
  card_id: number;
  slot_kind: SlotKind;
};

export function toThumbs<T>(
  cards: T[] | undefined,
  pick: (c: T) => Thumb,
  limit = 5
): Thumb[] {
  if (!cards) return [];
  return cards.slice(0, limit).map(pick);
}
