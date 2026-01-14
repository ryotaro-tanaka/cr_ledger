import type { Player } from "./player";

const KEY_SELECTED_PLAYER = "cr-ledger:selectedPlayer";

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
