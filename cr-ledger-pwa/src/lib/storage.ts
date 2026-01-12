// src/lib/storage.ts
const KEY = "cr-ledger-pwa:v1";

export type StoredState = {
  selectedDeckKey?: string;
  trendMode?: "last" | "since";
  trendLast?: number;
  trendSince?: string;
  deckLast?: number;
  deckMin?: number;
  decisionMemoByDeck?: Record<string, string>;
};

export function loadState(): StoredState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredState;
  } catch {
    return {};
  }
}

export function saveState(patch: Partial<StoredState>) {
  const current = loadState();
  const next = { ...current, ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
}
