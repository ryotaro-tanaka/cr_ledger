import type { Player } from "./types";

const KEY_SELECTED_PLAYER = "cr-ledger:selectedPlayer";
const KEY_SELECTED_DECK = "cr-ledger:selectedDeckKey";

export function loadSelectedPlayer(): Player | null {
  try {
    const raw = localStorage.getItem(KEY_SELECTED_PLAYER);
    if (!raw) return null;
    const v = JSON.parse(raw) as Player;
    if (!v?.player_tag) return null;
    return v;
  } catch {
    return null;
  }
}

export function saveSelectedPlayer(p: Player) {
  try {
    localStorage.setItem(KEY_SELECTED_PLAYER, JSON.stringify(p));
  } catch {
    // ignore
  }
}

export function clearSelectedPlayer() {
  try {
    localStorage.removeItem(KEY_SELECTED_PLAYER);
  } catch {
    // ignore
  }
}

// --- deck ---
export function loadSelectedDeckKey(): string | null {
  try {
    const v = localStorage.getItem(KEY_SELECTED_DECK);
    if (!v) return null;
    return v;
  } catch {
    return null;
  }
}

export function saveSelectedDeckKey(deckKey: string) {
  try {
    localStorage.setItem(KEY_SELECTED_DECK, deckKey);
  } catch {
    // ignore
  }
}

export function clearSelectedDeckKey() {
  try {
    localStorage.removeItem(KEY_SELECTED_DECK);
  } catch {
    // ignore
  }
}
