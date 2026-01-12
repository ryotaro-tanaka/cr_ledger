// src/api/api.ts
import type {
  MatchupByCardResponse,
  MyDecksResponse,
  OpponentTrendResponse,
  PriorityResponse,
  SyncResponse,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE as string | undefined;
const AUTH = import.meta.env.VITE_CR_LEDGER_AUTH as string | undefined;

export class AuthError extends Error {
  status = 401 as const;
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthError";
  }
}

export class ApiError extends Error {
  status: number;
  bodyText?: string;
  constructor(status: number, message: string, bodyText?: string) {
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  requireEnv();
  const url = `${API_BASE}${path}`;

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${AUTH}`);

  const method = (init?.method || "GET").toUpperCase();
  if (method === "POST" && !headers.get("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...init, headers });

  if (res.status === 401) {
    throw new AuthError("Auth failed (token missing/invalid). Check VITE_CR_LEDGER_AUTH.");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, `API error: ${res.status}`, text);
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return text as any;
  }
  return (await res.json()) as T;
}

export function sync(): Promise<SyncResponse> {
  // ボディは不要なら空でもOK。Workers側が要求するなら調整
  return request<SyncResponse>("/api/sync", { method: "POST", body: JSON.stringify({}) });
}

export function getMyDecks(last: number): Promise<MyDecksResponse> {
  return request<MyDecksResponse>(`/api/stats/my-decks?last=${encodeURIComponent(String(last))}`);
}

export function getOpponentTrendLast(last: number): Promise<OpponentTrendResponse> {
  return request<OpponentTrendResponse>(`/api/stats/opponent-trend?last=${encodeURIComponent(String(last))}`);
}

export function getOpponentTrendSince(since: string): Promise<OpponentTrendResponse> {
  return request<OpponentTrendResponse>(`/api/stats/opponent-trend?since=${encodeURIComponent(since)}`);
}

export function getMatchupByCard(params: {
  myDeckKey: string;
  last: number;
  min: number;
}): Promise<MatchupByCardResponse> {
  const q = new URLSearchParams({
    my_deck_key: params.myDeckKey,
    last: String(params.last),
    min: String(params.min),
  });
  return request<MatchupByCardResponse>(`/api/stats/matchup-by-card?${q.toString()}`);
}

export function getPriority(params: {
  myDeckKey: string;
  last: number;
  min: number;
}): Promise<PriorityResponse> {
  const q = new URLSearchParams({
    my_deck_key: params.myDeckKey,
    last: String(params.last),
    min: String(params.min),
  });
  return request<PriorityResponse>(`/api/stats/priority?${q.toString()}`);
}
