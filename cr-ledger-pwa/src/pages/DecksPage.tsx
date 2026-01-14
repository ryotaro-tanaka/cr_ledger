import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getMyDecks } from "../api/api";
import type { MyDecksResponse } from "../api/types";
import { usePlayer } from "../lib/player";
import { toErrorText } from "../lib/errors";
import FullPageLoading from "../components/FullPageLoading";
import ApiErrorPanel from "../components/ApiErrorPanel";

export default function DecksPage() {
  const { player } = usePlayer();
  const [data, setData] = useState<MyDecksResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!player) return;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await getMyDecks(player.player_tag, 200);
        setData(res);
      } catch (e) {
        setErr(toErrorText(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [player]);

  const decks = useMemo(() => data?.decks ?? [], [data]);

  if (loading && !data) return <FullPageLoading label="Loading decks..." />;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <h1 className="text-xl font-semibold">Decks</h1>
        {data ? <div className="text-xs text-neutral-400">total_battles: {data.total_battles}</div> : null}
      </div>

      {err ? <ApiErrorPanel detail={err} /> : null}

      {!loading && data && decks.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-300">
          No decks found.
        </div>
      ) : null}

      <div className="space-y-2">
        {decks.map((d) => {
          const name = d.deck_name ?? "(no name)";
          const shortKey = d.my_deck_key.length > 40 ? d.my_deck_key.slice(0, 40) + "…" : d.my_deck_key;

          return (
            <Link
              key={d.my_deck_key}
              to={`/decks/${encodeURIComponent(d.my_deck_key)}`}
              className="block rounded-2xl border border-neutral-800 bg-neutral-950 p-4 hover:bg-neutral-900"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-neutral-100">{name}</div>
                  <div className="mt-1 truncate text-xs text-neutral-400">{shortKey}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-neutral-500">battles</div>
                  <div className="text-sm font-semibold text-neutral-100">{d.battles}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
