import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loadSelectedPlayer, saveSelectedPlayer, clearSelectedPlayer } from "./storage";

export type Player = {
  player_tag: string;
  player_name: string;
};

type PlayerCtx = {
  player: Player | null;
  setPlayer: (p: Player) => void;
  clearPlayer: () => void;
};

const Ctx = createContext<PlayerCtx | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [player, setPlayerState] = useState<Player | null>(() => loadSelectedPlayer());

  const setPlayer = (p: Player) => {
    setPlayerState(p);
    saveSelectedPlayer(p);
  };

  const clearPlayer = () => {
    setPlayerState(null);
    clearSelectedPlayer();
  };

  // ほかのタブでlocalStorageが変わった場合に追随（任意だが便利）
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "cr-ledger:selectedPlayer") {
        setPlayerState(loadSelectedPlayer());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo<PlayerCtx>(() => ({ player, setPlayer, clearPlayer }), [player]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
  return ctx;
}
