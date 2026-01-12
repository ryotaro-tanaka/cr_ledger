// src/cards/cardMaster.ts
import type { RoyaleApiCardsResponse, SlotKind } from "../api/types";

const API_BASE = import.meta.env.VITE_API_BASE as string | undefined;
const AUTH = import.meta.env.VITE_CR_LEDGER_AUTH as string | undefined;

type CardView = {
  id: number;
  name: string;
  iconUrlByKind: Partial<Record<SlotKind, string>>;
};

export type CardMaster = {
  getName(id: number): string | null;
  getIconUrl(id: number, kind: SlotKind): string | null;
};

type CachePayload = {
  fetchedAt: number;
  data: RoyaleApiCardsResponse;
};

const LS_KEY = "cr-ledger:cards:v1";
const TTL_MS = 24 * 60 * 60 * 1000; // 1 day
// const TTL_MS = 0; // 7 days

type IconUrls = {
  medium?: string;
  evolutionMedium?: string;
  heroMedium?: string;
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
      iconUrlByKind: {
        support: s.iconUrls?.medium,
      },
    });
  }

  return {
    getName(id: number) {
      return map.get(id)?.name ?? null;
    },
    getIconUrl(id: number, kind: SlotKind) {
      const v = map.get(id);
      if (!v) return null;
      return v.iconUrlByKind[kind] ?? null;
    },
  };
}

function loadCache(): CachePayload | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachePayload;
  } catch {
    return null;
  }
}

function saveCache(payload: CachePayload) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch {
    // ignore (quota etc.)
  }
}

function requireEnv() {
  if (!API_BASE) throw new Error("VITE_API_BASE is not set");
  if (!AUTH) throw new Error("VITE_CR_LEDGER_AUTH is not set");
}

export async function getCardMaster(): Promise<CardMaster> {
  const cached = loadCache();
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return buildMaster(cached.data);
  }

  requireEnv();

  // ★ 取得先を backend の /api/cards に変更
  const url = `${API_BASE}/api/cards?nocache=1`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${AUTH}`,
    },
  });

  if (!res.ok) {
    // キャッシュがあれば古くても使う（オフライン/一時障害対策）
    if (cached) return buildMaster(cached.data);
    throw new Error(`Failed to fetch card master from /api/cards: ${res.status}`);
  }

  const data = (await res.json()) as RoyaleApiCardsResponse;
  saveCache({ fetchedAt: Date.now(), data });
  return buildMaster(data);
}
