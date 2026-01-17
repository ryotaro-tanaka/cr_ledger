import { useEffect, useMemo, useState } from "react";
import { getOpponentTrendLast } from "../api/api";
import type { OpponentTrendResponse } from "../api/types";
import { useSelection } from "../lib/selection";
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
  const { player } = useSelection();
  const [data, setData] = useState<OpponentTrendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { master, loading: cardsLoading, error: cardsError } = useCardMaster();

  const last = 500;

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
  const { count, hasMore, sentinelRef } = useInfiniteCount({
    total: cards.length,
    initial: 15,
    step: 15,
  });
  const visible = useMemo(() => cards.slice(0, count), [cards, count]);

  if ((loading || cardsLoading) && !data) return <FullPageLoading label="Loading trend..." />;

  return (
    <section className="mx-auto max-w-md space-y-3 px-4 pt-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">Trend</h1>
          <div className="mt-1 text-xs text-slate-500">Most used opponent cards</div>
        </div>
        <div className="text-[11px] text-slate-500">last={last}</div>
      </div>

      {cardsError ? <ApiErrorPanel title="Cards error" detail={cardsError} /> : null}
      {err ? <ApiErrorPanel detail={err} /> : null}

      {!loading && !err && data && cards.length === 0 ? (
        <div className="rounded-[22px] border border-slate-200 bg-white/80 p-4 text-sm text-slate-700 shadow-sm backdrop-blur">
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
              subtitle={c.slot_kind}
              metrics={[
                { label: "usage", value: pct01(c.usage_rate), strong: true },
                { label: "battles", value: num(c.battles) },
              ]}
            />
          );
        })}

        <div ref={sentinelRef} />
        {hasMore ? <div className="py-2 text-center text-xs text-slate-500">Loading more…</div> : null}
      </div>
    </section>
  );
}
