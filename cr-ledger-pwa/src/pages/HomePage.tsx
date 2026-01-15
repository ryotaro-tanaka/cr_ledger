import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getOpponentTrendLast, getPriority, sync } from "../api/api";
import type { OpponentTrendResponse, PriorityResponse, SyncResponse } from "../api/types";
import { useSelection } from "../lib/selection";
import { toErrorText } from "../lib/errors";
import ApiErrorPanel from "../components/ApiErrorPanel";
import { useCardMaster } from "../cards/useCardMaster";

type SectionState<T> = {
  data: T | null;
  loading: boolean;
  err: string | null;
};

function num(v: number): string {
  return String(Math.trunc(v));
}

export default function HomePage() {
  const nav = useNavigate();
  const { player, deckKey } = useSelection();

  // NOTE: Cards master is optional here — never block initial paint.
  const { master, error: cardsError } = useCardMaster();

  // Sync state
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncRes, setSyncRes] = useState<SyncResponse | null>(null);
  const [syncErr, setSyncErr] = useState<string | null>(null);

  // Dashboard sections (independent + non-blocking)
  const [priorityState, setPriorityState] = useState<SectionState<PriorityResponse>>({
    data: null,
    loading: false,
    err: null,
  });
  const [trendState, setTrendState] = useState<SectionState<OpponentTrendResponse>>({
    data: null,
    loading: false,
    err: null,
  });

  const lastPriority = 500;
  const lastTrend = 500;

  // Fetch Priority (non-blocking)
  useEffect(() => {
    if (!player || !deckKey) return;

    let cancelled = false;

    void (async () => {
      setPriorityState((s) => ({ ...s, loading: true, err: null }));
      try {
        const res = await getPriority(player.player_tag, deckKey, lastPriority);
        res.cards.sort((a, b) => b.priority_score - a.priority_score);
        if (!cancelled) setPriorityState({ data: res, loading: false, err: null });
      } catch (e) {
        if (!cancelled) setPriorityState({ data: null, loading: false, err: toErrorText(e) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [player, deckKey]);

  // Fetch Trend (non-blocking)
  useEffect(() => {
    if (!player) return;

    let cancelled = false;

    void (async () => {
      setTrendState((s) => ({ ...s, loading: true, err: null }));
      try {
        const res = await getOpponentTrendLast(player.player_tag, lastTrend);
        res.cards.sort((a, b) => b.usage_rate - a.usage_rate);
        if (!cancelled) setTrendState({ data: res, loading: false, err: null });
      } catch (e) {
        if (!cancelled) setTrendState({ data: null, loading: false, err: toErrorText(e) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [player]);

  const topPriority = useMemo(
    () => (priorityState.data?.cards ?? []).slice(0, 5),
    [priorityState.data]
  );
  const topTrend = useMemo(() => (trendState.data?.cards ?? []).slice(0, 5), [trendState.data]);

  // RequireSelection がいる想定なので通常は来ない
  if (!player || !deckKey) return null;

  return (
    <section className="space-y-3">
      {/* header */}
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Home</h1>
        <div className="text-xs text-neutral-400">
          {player.player_name} ({player.player_tag})
        </div>
        <div className="text-[10px] text-neutral-500 break-all">{deckKey}</div>
      </div>

      {/* Sync */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-neutral-200">Sync</div>
          <div className="text-xs text-neutral-500">POST /api/sync</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled={syncLoading}
            onClick={async () => {
              setSyncLoading(true);
              setSyncErr(null);
              setSyncRes(null);
              try {
                const r = await sync(player.player_tag);
                setSyncRes(r);
              } catch (e) {
                setSyncErr(toErrorText(e));
              } finally {
                setSyncLoading(false);
              }
            }}
            className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm hover:bg-neutral-900 disabled:opacity-60"
          >
            {syncLoading ? "Syncing..." : "Sync now"}
          </button>

          {syncLoading ? <div className="text-xs text-neutral-400">Working...</div> : null}
        </div>

        {syncErr ? <ApiErrorPanel detail={syncErr} /> : null}

        {syncRes ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-200/80">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-neutral-400">upserted</div>
              <div className="text-right">{num(syncRes.synced?.upserted ?? 0)}</div>
              <div className="text-neutral-400">total_fetched</div>
              <div className="text-right">{num(syncRes.synced?.total_fetched ?? 0)}</div>
              <div className="text-neutral-400">stopped_early</div>
              <div className="text-right">{num(syncRes.synced?.stopped_early ?? 0)}</div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Cards master error is non-fatal for Home */}
      {cardsError ? <ApiErrorPanel title="Cards error" detail={cardsError} /> : null}

      {/* Priority (Top 5) - image focused */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-neutral-200">Priority</div>
          <button onClick={() => nav("/priority")} className="text-xs text-neutral-400 hover:text-neutral-200">
            Open →
          </button>
        </div>

        {priorityState.err ? <ApiErrorPanel detail={priorityState.err} /> : null}

        {priorityState.loading && topPriority.length === 0 ? (
          <div className="text-sm text-neutral-400">Loading…</div>
        ) : topPriority.length === 0 ? (
          <div className="text-sm text-neutral-400">No data.</div>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {topPriority.map((c) => {
              const icon = master?.getIconUrl(c.card_id, c.slot_kind) ?? null;
              const title = master?.getName(c.card_id) ?? `#${c.card_id}`;

              return (
                <button
                  key={`${c.card_id}:${c.slot_kind}`}
                  onClick={() => nav("/priority")}
                  className="rounded-2xl border border-neutral-800 bg-neutral-950 p-1 hover:bg-neutral-900"
                  title={title}
                >
                  <div className="aspect-square overflow-hidden rounded-xl bg-neutral-900">
                    {icon ? (
                      <img src={icon} alt={title} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="h-full w-full" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="text-[11px] text-neutral-500">
          last={lastPriority} · top 5 cards (tap to open Priority tab)
        </div>
      </div>

      {/* Trend (Top 5) - image focused */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-neutral-200">Trend</div>
          <button onClick={() => nav("/trend")} className="text-xs text-neutral-400 hover:text-neutral-200">
            Open →
          </button>
        </div>

        {trendState.err ? <ApiErrorPanel detail={trendState.err} /> : null}

        {trendState.loading && topTrend.length === 0 ? (
          <div className="text-sm text-neutral-400">Loading…</div>
        ) : topTrend.length === 0 ? (
          <div className="text-sm text-neutral-400">No data.</div>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {topTrend.map((c) => {
              const icon = master?.getIconUrl(c.card_id, c.slot_kind) ?? null;
              const title = master?.getName(c.card_id) ?? `#${c.card_id}`;

              return (
                <button
                  key={`${c.card_id}:${c.slot_kind}`}
                  onClick={() => nav("/trend")}
                  className="rounded-2xl border border-neutral-800 bg-neutral-950 p-1 hover:bg-neutral-900"
                  title={title}
                >
                  <div className="aspect-square overflow-hidden rounded-xl bg-neutral-900">
                    {icon ? (
                      <img src={icon} alt={title} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="h-full w-full" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="text-[11px] text-neutral-500">
          last={lastTrend} · top 5 cards (tap to open Trend tab)
        </div>
      </div>
    </section>
  );
}
