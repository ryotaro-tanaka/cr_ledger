import type { RoyaleApiCardsResponse, SlotKind } from "../api/types";
import { getCards } from "../api/api";

type IconUrls = {
  medium?: string;
  evolutionMedium?: string;
  heroMedium?: string;
};

type CardView = {
  id: number;
  name: string;
  iconUrlByKind: Partial<Record<SlotKind, string>>;
};

export type CardMaster = {
  getName(id: number): string | null;
  getIconUrl(id: number, kind: SlotKind): string | null;
};

function pickIcon(item: { iconUrls?: IconUrls }, kind: SlotKind): string | undefined {
  const u = item.iconUrls ?? {};
  if (kind === "normal") return u.medium;
  if (kind === "evolution") return u.evolutionMedium ?? u.medium;
  if (kind === "hero") return u.heroMedium ?? u.medium;
  return undefined;
}

function buildMaster(resp: RoyaleApiCardsResponse): CardMaster {
  const map = new Map<number, CardView>();

  for (const it of resp.items ?? []) {
    map.set(it.id, {
      id: it.id,
      name: it.name,
      iconUrlByKind: {
        normal: pickIcon(it, "normal"),
        evolution: pickIcon(it, "evolution"),
        hero: pickIcon(it, "hero"),
      },
    });
  }

  for (const s of resp.supportItems ?? []) {
    map.set(s.id, {
      id: s.id,
      name: s.name,
      iconUrlByKind: { support: s.iconUrls?.medium },
    });
  }

  return {
    getName(id: number) {
      return map.get(id)?.name ?? null;
    },
    getIconUrl(id: number, kind: SlotKind) {
      return map.get(id)?.iconUrlByKind[kind] ?? null;
    },
  };
}

let cached: CardMaster | null = null;

export async function loadCardMaster(opts?: { nocache?: boolean }): Promise<CardMaster> {
  if (cached && !opts?.nocache) return cached;
  const data = await getCards({ nocache: !!opts?.nocache });
  cached = buildMaster(data);
  return cached;
}

export function clearCardMasterMemoryCache() {
  cached = null;
}
