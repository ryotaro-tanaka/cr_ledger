// src/cards/useCardMaster.ts
import { useEffect, useState } from "react";
import type { CardMaster } from "./cardMaster";
import { getCardMaster } from "./cardMaster";

export function useCardMaster() {
  const [master, setMaster] = useState<CardMaster | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const m = await getCardMaster();
        setMaster(m);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { master, loading, error };
}
