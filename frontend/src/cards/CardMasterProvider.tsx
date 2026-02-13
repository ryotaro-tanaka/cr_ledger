/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CardMaster } from "./cardMaster";
import { clearCardMasterMemoryCache, loadCardMaster } from "./cardMaster";
import { toErrorText } from "../lib/errors";

type CardMasterCtx = {
  master: CardMaster | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const Ctx = createContext<CardMasterCtx | null>(null);

export function CardMasterProvider({ children }: { children: React.ReactNode }) {
  const [master, setMaster] = useState<CardMaster | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nocache?: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const m = await loadCardMaster({ nocache: !!nocache });
      setMaster(m);
    } catch (e) {
      setError(toErrorText(e));
      setMaster(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(async () => {
    clearCardMasterMemoryCache();
    await load(true);
  }, [load]);

  const value = useMemo(() => ({ master, loading, error, refresh }), [master, loading, error, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCardMasterContext() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCardMasterContext must be used inside CardMasterProvider");
  return ctx;
}
