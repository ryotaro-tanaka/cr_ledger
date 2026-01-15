import { useEffect, useMemo, useState } from "react";
import { getPriority } from "../api/api";
import type { PriorityResponse } from "../api/types";
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

export default function PriorityPage() {
  const { player, deckKey } = useSelection();
  const last = 500;

  const [data, setData] = useState<PriorityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { master, loading: cardsLoading, error: cardsError } = useCardMaster();

  useEffect(() => {
    if (!player || !deckKey) return;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await getPriority(player.player_tag, deckKey, last);
        res.cards.sort((a, b) => b.priority_score - a.priority_score);
        setData(res);
      } catch (e) {
        setErr(toErrorText(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [player, deckKey]);

  const list = useMemo(() => data?.cards ?? [], [data]);
  const { count, hasMore, sentinelRef } = useInfiniteCount({ total: list.length, initial: 15, step: 15 });
  const visible = useMemo(() => list.slice(0, count), [list, count]);

  if ((loading || cardsLoading) && !data) return <FullPageLoading label="Loading priority..." />;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <h1 className="text-xl font-semibold">Priority</h1>
        <div className="text-xs text-neutral-400">last={last}</div>
      </div>

      {cardsError ? <ApiErrorPanel title="Cards error" detail={cardsError} /> : null}
      {err ? <ApiErrorPanel detail={err} /> : null}

      {!loading && !err && data && list.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-300">No results.</div>
      ) : null}

      <div className="space-y-2">
        {visible.map((pc) => {
          const name = master?.getName(pc.card_id) ?? `#${pc.card_id}`;
          const icon = master?.getIconUrl(pc.card_id, pc.slot_kind) ?? null;
          const isSmallSample = pc.deck_battles_with_card < 10;
          const subtitle = `${pc.slot_kind}${isSmallSample ? " • small sample" : ""}`;

          return (
            <CardRow
              key={`${pc.card_id}:${pc.slot_kind}`}
              iconUrl={icon}
              title={name}
              subtitle={subtitle}
              metrics={[
                { label: "priority", value: pc.priority_score.toFixed(3), strong: true },
                { label: "usage", value: pct01(pc.usage_rate) },
                { label: "win", value: pct01(pc.win_rate) },
              ]}
              expanded={
                <div className="grid grid-cols-2 gap-2 text-xs text-neutral-200">
                  <div className="text-neutral-400">deck_battles_with_card</div>
                  <div className="text-right">{num(pc.deck_battles_with_card)}</div>
                  <div className="text-neutral-400">usage_rate</div>
                  <div className="text-right">{pct01(pc.usage_rate)}</div>
                  <div className="text-neutral-400">win_rate</div>
                  <div className="text-right">{pct01(pc.win_rate)}</div>
                  <div className="text-neutral-400">priority_score</div>
                  <div className="text-right font-semibold">{pc.priority_score.toFixed(6)}</div>
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
