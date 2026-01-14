import React, { useEffect, useMemo, useState } from "react";
import { getOpponentTrendLast } from "../api/api";
import type { OpponentTrendResponse } from "../api/types";
import { usePlayer } from "../lib/player";
import { toErrorText } from "../lib/errors";
import { useCardMaster } from "../cards/useCardMaster";
import ApiErrorPanel from "../components/ApiErrorPanel";
import FullPageLoading from "../components/FullPageLoading";
import CardRow from "../components/CardRow";
import { useInfiniteCount } from "../lib/useInfiniteCount";

function pct01(v: number): string {
  const p = Math.round(v * 1000) / 10;
  return `${p.toFixed(1)}%`;
}
function num(v: number): string {
  return String(Math.trunc(v));
}

export default function TrendPage() {
  const { player } = usePlayer();
  const [data, setData] = useState<OpponentTrendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { master, loading: cardsLoading, error: cardsError } = useCardMaster();

  const last = 200;

  useEffect(() => {
    if (!player) return;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await getOpponentTrendLast(player.player_tag, last);
        res.cards.sort((a, b) => b.usage_rate - a.usage_rate);
        setData(res);
      } catch (e) {
        setErr(toErrorText(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [player]);

  const cards = useMemo(() => data?.cards ?? [], [data]);
  const { count, hasMore, sentinelRef } = useInfiniteCount({ total: cards.length, initial: 15, step: 15 });
  const visible = useMemo(() => cards.slice(0, count), [cards, count]);

  if ((loading || cardsLoading) && !data) return <FullPageLoading label="Loading trend..." />;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <h1 className="text-xl font-semibold">Trend</h1>
        <div className="text-xs text-neutral-400">last={last}</div>
      </div>

      {cardsError ? <ApiErrorPanel title="Cards error" detail={cardsError} /> : null}
      {err ? <ApiErrorPanel detail={err} /> : null}

      {!loading && !err && data && cards.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-300">
          No trend data.
        </div>
      ) : null}

      <div className="space-y-2">
        {visible.map((c) => {
          const name = master?.getName(c.card_id) ?? `#${c.card_id}`;
          const icon = master?.getIconUrl(c.card_id, c.slot_kind) ?? null;

          return (
            <CardRow
              key={`${c.card_id}:${c.slot_kind}`}
              iconUrl={icon}
              title={name}
              subtitle={`${c.slot_kind}`}
              metrics={[
                { label: "usage", value: pct01(c.usage_rate), strong: true },
                { label: "battles", value: num(c.battles) },
              ]}
              expanded={
                <div className="grid grid-cols-2 gap-2 text-xs text-neutral-200">
                  <div className="text-neutral-400">slot_kind</div>
                  <div className="text-right">{c.slot_kind}</div>
                  <div className="text-neutral-400">battles</div>
                  <div className="text-right">{num(c.battles)}</div>
                  <div className="text-neutral-400">usage_rate</div>
                  <div className="text-right font-semibold">{pct01(c.usage_rate)}</div>
                </div>
              }
            />
          );
        })}

        <div ref={sentinelRef} />
        {hasMore ? <div className="py-2 text-center text-xs text-neutral-500">Loading more…</div> : null}
      </div>
    </section>
  );
}
