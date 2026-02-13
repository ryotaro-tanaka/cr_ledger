/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getPlayers } from "../api/api";
import type { PlayersResponse } from "../api/types";
import { toErrorText } from "./errors";

type CommonPlayersCtx = {
  data: PlayersResponse | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

const Ctx = createContext<CommonPlayersCtx | null>(null);

export function CommonPlayersProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<PlayersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPlayers();
      setData(res);
    } catch (e) {
      setError(toErrorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo(
    () => ({ data, loading, error, reload }),
    [data, loading, error, reload]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCommonPlayers() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCommonPlayers must be used inside CommonPlayersProvider");
  return ctx;
}
