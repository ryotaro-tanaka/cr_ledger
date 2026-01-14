import { useCallback, useEffect, useState } from "react";
import type { CardMaster } from "./cardMaster";
import { clearCardMasterMemoryCache, loadCardMaster } from "./cardMaster";
import { toErrorText } from "../lib/errors";

export function useCardMaster() {
  const [master, setMaster] = useState<CardMaster | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
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
    // サーバーキャッシュを無効にした最新版を取得したい時だけ
    clearCardMasterMemoryCache();
    await load(true);
  }, [load]);

  return { master, loading, error, refresh };
}
