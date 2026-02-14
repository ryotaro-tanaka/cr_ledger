import type {
  PlayersResponse,
  RoyaleApiCardsResponse,
  SyncResponse,
  DeckSummaryResponse,
  DeckOffenseCountersResponse,
  DeckDefenseThreatsResponse,
  TrendTraitsResponse,
  TrendWinConditionsResponse,
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

async function request<T>(
  path: string,
  opts?: {
    method?: "GET" | "POST" | "PATCH";
    params?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
  }
): Promise<T> {
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

export function getPlayers(last = 200): Promise<PlayersResponse> {
  return request<PlayersResponse>("/api/common/players", { params: { last } });
}

export function sync(playerTag: string): Promise<SyncResponse> {
  return request<SyncResponse>("/api/common/sync", { method: "POST", body: { player_tag: playerTag } });
}

export function getCards(opts?: { nocache?: boolean }): Promise<RoyaleApiCardsResponse> {
  return request<RoyaleApiCardsResponse>("/api/common/cards", { params: { nocache: opts?.nocache ? 1 : undefined } });
}

export function updateDeckName(myDeckKey: string, deckName: string): Promise<{ ok: true }> {
  return request<{ ok: true }>("/api/common/my-decks/name", {
    method: "PATCH",
    body: { my_deck_key: myDeckKey, deck_name: deckName },
  });
}

export function getDeckSummary(myDeckKey: string): Promise<DeckSummaryResponse> {
  return request<DeckSummaryResponse>(`/api/decks/${encodeURIComponent(myDeckKey)}/summary`);
}

export function getDeckOffenseCounters(myDeckKey: string, seasons = 2): Promise<DeckOffenseCountersResponse> {
  return request<DeckOffenseCountersResponse>(`/api/decks/${encodeURIComponent(myDeckKey)}/offense/counters`, {
    params: { seasons },
  });
}

export function getDeckDefenseThreats(myDeckKey: string, seasons = 2): Promise<DeckDefenseThreatsResponse> {
  return request<DeckDefenseThreatsResponse>(`/api/decks/${encodeURIComponent(myDeckKey)}/defense/threats`, {
    params: { seasons },
  });
}

export function getTrendTraits(playerTag: string, seasons = 2): Promise<TrendTraitsResponse> {
  return request<TrendTraitsResponse>(`/api/trend/${encodeURIComponent(playerTag)}/traits`, {
    params: { seasons },
  });
}


export function getTrendWinConditions(playerTag: string, last = 200): Promise<TrendWinConditionsResponse> {
  return request<TrendWinConditionsResponse>(`/api/trend/${encodeURIComponent(playerTag)}/win-conditions`, {
    params: { last },
  });
}
