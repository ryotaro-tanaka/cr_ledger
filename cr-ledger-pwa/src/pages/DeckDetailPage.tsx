import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getMatchupByCard, getPriority } from "../api/api";
import type { MatchupByCardResponse, PriorityResponse } from "../api/types";
import { usePlayer } from "../lib/player";
import { toErrorText } from "../lib/errors";
import { useCardMaster } from "../cards/useCardMaster";
import ApiErrorPanel from "../components/ApiErrorPanel";
import FullPageLoading from "../components/FullPageLoading";
import CardRow from "../components/CardRow";
import { useInfiniteCount } from "../lib/useInfiniteCount";

type Tab = "priority" | "matchup";

function pct01(v: number): string {
  // 0.1234 -> 12.3%
  const p = Math.round(v * 1000) / 10;
  return `${p.toFixed(1)}%`;
}
function num(v: number): string {
  return String(Math.trunc(v));
}

export default function DeckDetailPage() {
  const { player } = usePlayer();
  const { deckKey } = useParams();
  const decodedKey = useMemo(() => {
    if (!deckKey) return "";
    try {
      return decodeURIComponent(deckKey);
    } catch {
      return deckKey;
    }
  }, [deckKey]);

  const [tab, setTab] = useState<Tab>("priority");

  const last = 500;

  const [priority, setPriority] = useState<PriorityResponse | null>(null);
  const [matchup, setMatchup] = useState<MatchupByCardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { master, loading: cardsLoading, error: cardsError } = useCardMaster();

  // fetch when tab changes
  useEffect(() => {
    if (!decodedKey) return;
    if (!player) return;

    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        if (tab === "priority") {
          const res = await getPriority(player.player_tag, decodedKey, last);
          // priority_score desc (念のため)
          res.cards.sort((a, b) => b.priority_score - a.priority_score);
          setPriority(res);
        } else {
          const res = await getMatchupByCard(player.player_tag, decodedKey, last);
          // 苦手が上：win_rate asc
          res.cards.sort((a, b) => a.win_rate - b.win_rate);
          setMatchup(res);
        }
      } catch (e) {
        setErr(toErrorText(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [decodedKey, player, tab]);

  const list = useMemo(() => {
    if (tab === "priority") return priority?.cards ?? [];
    return matchup?.cards ?? [];
  }, [matchup, priority, tab]);

  const { count, hasMore, sentinelRef } = useInfiniteCount({
    total: list.length,
    initial: 15,
    step: 15,
  });
  const visible = useMemo(() => list.slice(0, count), [list, count]);

  if (!decodedKey) {
    return (
      <section className="space-y-3">
        <h1 className="text-xl font-semibold">Deck Detail</h1>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-300">
          Missing deckKey.
        </div>
      </section>
    );
  }

  if ((loading || cardsLoading) && !priority && !matchup) {
    return <FullPageLoading label="Loading deck detail..." />;
  }

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Deck Detail</h1>
        <div className="text-xs text-neutral-400 break-all">{decodedKey}</div>
      </div>

      {/* segmented tabs */}
      <div className="flex rounded-2xl border border-neutral-800 bg-neutral-900/40 p-1">
        <button
          onClick={() => setTab("priority")}
          className={[
            "w-1/2 rounded-xl px-3 py-2 text-sm font-medium",
            tab === "priority"
              ? "bg-neutral-950 text-white"
              : "text-neutral-300 hover:text-neutral-100",
          ].join(" ")}
        >
          Priority
        </button>
        <button
          onClick={() => setTab("matchup")}
          className={[
            "w-1/2 rounded-xl px-3 py-2 text-sm font-medium",
            tab === "matchup"
              ? "bg-neutral-950 text-white"
              : "text-neutral-300 hover:text-neutral-100",
          ].join(" ")}
        >
          Matchup
        </button>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-neutral-200">
            {tab === "priority" ? "Top threats to practice" : "Hard matchups"}
          </div>
          <div className="text-xs text-neutral-400">last={last}</div>
        </div>

        {cardsError ? (
          <div className="mt-3">
            <ApiErrorPanel title="Cards error" detail={cardsError} />
          </div>
        ) : null}

        {err ? (
          <div className="mt-3">
            <ApiErrorPanel detail={err} />
          </div>
        ) : null}

        {!loading && !err && list.length === 0 ? (
          <div className="mt-3 text-sm text-neutral-300">
            No results.
          </div>
        ) : null}
      </div>

      {/* list */}
      <div className="space-y-2">
        {visible.map((c) => {
          const name = master?.getName(c.card_id) ?? `#${c.card_id}`;
          const icon = master?.getIconUrl(c.card_id, c.slot_kind) ?? null;

          if (tab === "priority") {
            const pc = c as PriorityResponse["cards"][number];
            const isSmallSample = pc.deck_battles_with_card < 10;
            const subtitle = `${pc.slot_kind}${
              isSmallSample ? " • small sample" : ""
            }`;

            return (
              <CardRow
                key={`${pc.card_id}:${pc.slot_kind}`}
                iconUrl={icon}
                title={name}
                subtitle={subtitle}
                metrics={[
                  {
                    label: "priority",
                    value: pc.priority_score.toFixed(3),
                    strong: true,
                  },
                  { label: "usage", value: pct01(pc.usage_rate) },
                  { label: "win", value: pct01(pc.win_rate) },
                ]}
                expanded={
                  <div className="grid grid-cols-2 gap-2 text-xs text-neutral-200">
                    <div className="text-neutral-400">deck_battles_with_card</div>
                    <div className="text-right">
                      {num(pc.deck_battles_with_card)}
                    </div>

                    <div className="text-neutral-400">usage_rate</div>
                    <div className="text-right">{pct01(pc.usage_rate)}</div>

                    <div className="text-neutral-400">win_rate</div>
                    <div className="text-right">{pct01(pc.win_rate)}</div>

                    <div className="text-neutral-400">priority_score</div>
                    <div className="text-right font-semibold">
                      {pc.priority_score.toFixed(6)}
                    </div>
                  </div>
                }
              />
            );
          } else {
            const mc = c as MatchupByCardResponse["cards"][number];
            const isSmallSample = mc.battles < 10;
            const subtitle = `${mc.slot_kind}${
              isSmallSample ? " • small sample" : ""
            }`;

            return (
              <CardRow
                key={`${mc.card_id}:${mc.slot_kind}`}
                iconUrl={icon}
                title={name}
                subtitle={subtitle}
                metrics={[
                  { label: "win", value: pct01(mc.win_rate), strong: true },
                  { label: "battles", value: num(mc.battles) },
                ]}
                expanded={
                  <div className="grid grid-cols-2 gap-2 text-xs text-neutral-200">
                    <div className="text-neutral-400">battles</div>
                    <div className="text-right">{num(mc.battles)}</div>

                    <div className="text-neutral-400">wins</div>
                    <div className="text-right">{num(mc.wins)}</div>

                    <div className="text-neutral-400">losses</div>
                    <div className="text-right">{num(mc.losses)}</div>

                    <div className="text-neutral-400">win_rate</div>
                    <div className="text-right font-semibold">
                      {pct01(mc.win_rate)}
                    </div>
                  </div>
                }
              />
            );
          }
        })}

        {/* sentinel */}
        <div ref={sentinelRef} />

        {hasMore ? (
          <div className="py-2 text-center text-xs text-neutral-500">
            Loading more…
          </div>
        ) : null}
      </div>
    </section>
  );
}
