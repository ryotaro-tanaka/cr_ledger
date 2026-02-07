import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Player } from "./types";
import {
  loadSelectedDeckKey,
  loadSelectedPlayer,
  saveSelectedDeckKey,
  saveSelectedPlayer,
  clearSelectedDeckKey,
  clearSelectedPlayer,
} from "./storage";

type SelectionCtx = {
  player: Player | null;
  setPlayer: (p: Player) => void;
  clearPlayer: () => void;

  deckKey: string | null;
  setDeckKey: (k: string) => void;
  clearDeckKey: () => void;
};

const Ctx = createContext<SelectionCtx | null>(null);

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [player, setPlayerState] = useState<Player | null>(() => loadSelectedPlayer());
  const [deckKey, setDeckKeyState] = useState<string | null>(() => loadSelectedDeckKey());

  const setPlayer = (p: Player) => {
    setPlayerState(p);
    saveSelectedPlayer(p);
  };
  const clearPlayerFn = () => {
    setPlayerState(null);
    clearSelectedPlayer();
  };

  const setDeckKey = (k: string) => {
    setDeckKeyState(k);
    saveSelectedDeckKey(k);
  };
  const clearDeckKeyFn = () => {
    setDeckKeyState(null);
    clearSelectedDeckKey();
  };

  // 他タブ同期（任意だが便利）
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "cr-ledger:selectedPlayer") setPlayerState(loadSelectedPlayer());
      if (e.key === "cr-ledger:selectedDeckKey") setDeckKeyState(loadSelectedDeckKey());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo<SelectionCtx>(
    () => ({
      player,
      setPlayer,
      clearPlayer: clearPlayerFn,
      deckKey,
      setDeckKey,
      clearDeckKey: clearDeckKeyFn,
    }),
    [player, deckKey]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSelection() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSelection must be used inside SelectionProvider");
  return ctx;
}
