import type {
  MyDecksResponse,
  OpponentTrendResponse,
  PlayersResponse,
  PriorityResponse,
  RoyaleApiCardsResponse,
  SyncResponse,
  MatchupByCardResponse,
  MyDeckCardsResponse,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE as string | undefined;
const AUTH = import.meta.env.VITE_CR_LEDGER_AUTH as string | undefined;

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export class ApiError extends Error {
  status: number;
  bodyText: string;
  constructor(message: string, status: number, bodyText: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.bodyText = bodyText;
  }
}

function requireEnv() {
  if (!API_BASE) throw new Error("VITE_API_BASE is not set");
  if (!AUTH) throw new Error("VITE_CR_LEDGER_AUTH is not set");
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>) {
  requireEnv();
  const u = new URL(path, API_BASE);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) continue;
      u.searchParams.set(k, String(v));
    }
  }
  return u.toString();
}

async function request<T>(path: string, opts?: { method?: "GET" | "POST" | "PATCH"; params?: Record<string, any>; body?: any }): Promise<T> {
  requireEnv();
  const url = buildUrl(path, opts?.params);

  const res = await fetch(url, {
    method: opts?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${AUTH}`,
      ...(opts?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();

  if (res.status === 401) {
    throw new AuthError("401 Unauthorized: VITE_CR_LEDGER_AUTH is missing or invalid.");
  }
  if (!res.ok) {
    throw new ApiError(`API request failed: ${res.status} ${res.statusText}`, res.status, text);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    // JSONじゃない場合でも bodyText を出せるように ApiError にする
    throw new ApiError("Failed to parse JSON response", res.status, text);
  }
}

// -------------------- endpoints --------------------

export function getPlayers(): Promise<PlayersResponse> {
  return request<PlayersResponse>("/api/players");
}

export function sync(playerTag: string): Promise<SyncResponse> {
  return request<SyncResponse>("/api/sync", { method: "POST", params: { player_tag: playerTag } });
}

export function getMyDecks(playerTag: string, last: number): Promise<MyDecksResponse> {
  return request<MyDecksResponse>("/api/stats/my-decks", { params: { player_tag: playerTag, last } });
}

export function getOpponentTrendLast(playerTag: string, last: number): Promise<OpponentTrendResponse> {
  return request<OpponentTrendResponse>("/api/stats/opponent-trend", { params: { player_tag: playerTag, last } });
}

export function getOpponentTrendSince(playerTag: string, since: string): Promise<OpponentTrendResponse> {
  return request<OpponentTrendResponse>("/api/stats/opponent-trend", { params: { player_tag: playerTag, since } });
}

export function getMatchupByCard(playerTag: string, myDeckKey: string, last: number): Promise<MatchupByCardResponse> {
  return request<MatchupByCardResponse>("/api/stats/matchup-by-card", {
    params: { player_tag: playerTag, my_deck_key: myDeckKey, last },
  });
}

export function getPriority(playerTag: string, myDeckKey: string, last: number): Promise<PriorityResponse> {
  return request<PriorityResponse>("/api/stats/priority", {
    params: { player_tag: playerTag, my_deck_key: myDeckKey, last },
  });
}

export function getCards(opts?: { nocache?: boolean }): Promise<RoyaleApiCardsResponse> {
  return request<RoyaleApiCardsResponse>("/api/cards", { params: { nocache: opts?.nocache ? 1 : undefined } });
}

export function getMyDeckCards(myDeckKey: string): Promise<MyDeckCardsResponse> {
  return request<MyDeckCardsResponse>("/api/my-deck-cards", {
    params: { my_deck_key: myDeckKey },
  });
}

export function updateDeckName(myDeckKey: string, deckName: string): Promise<{ ok: true }> {
  return request<{ ok: true }>("/api/my-decks/name", {
    method: "PATCH",
    body: { my_deck_key: myDeckKey, deck_name: deckName },
  });
}
