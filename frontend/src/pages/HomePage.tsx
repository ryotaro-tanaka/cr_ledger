import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelection } from "../lib/selection";
import ApiErrorPanel from "../components/ApiErrorPanel";
import SyncCard from "./home/SyncCard";
import SectionCard from "../components/SectionCard";
import { getDeckSummary } from "../api/api";
import type { DeckSummaryResponse } from "../api/types";
import { useCardMaster } from "../cards/useCardMaster";
import { toErrorText } from "../lib/errors";
import { useCommonPlayers } from "../lib/commonPlayers";

type MergedCard = {
  slot: number | null;
  card_id: number;
  slot_kind: "normal" | "evolution" | "hero" | "support";
  card_type: "unit" | "spell" | "building" | "support" | null;
  card_traits: string[];
  classes: string[];
};

function prettyKey(k: string): string {
  return k
    .replace(/^is_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function HomePage() {
  const nav = useNavigate();
  const { player, deckKey } = useSelection();
  const { master, loading: cardsLoading, error: cardsError } = useCardMaster();
  const { data: playersData } = useCommonPlayers();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<DeckSummaryResponse | null>(null);

  const playerLabel = player
    ? `${player.player_name} (${player.player_tag})`
    : "(not selected)";

  useEffect(() => {
    if (!deckKey) {
      setData(null);
      setErr(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await getDeckSummary(deckKey);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setErr(toErrorText(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deckKey]);

  const selectedDeckBase = useMemo(() => {
    const selectedPlayer = playersData?.players.find((p) => p.player_tag === player?.player_tag);
    return selectedPlayer?.decks.find((d) => d.my_deck_key === deckKey) ?? null;
  }, [playersData, player?.player_tag, deckKey]);

  const mergedCards = useMemo<MergedCard[]>(() => {
    const baseCards = selectedDeckBase?.cards ?? [];
    const summaryCards = data?.cards ?? [];

    const byKey = new Map<string, MergedCard>();

    for (const c of baseCards) {
      byKey.set(`${c.card_id}:${c.slot_kind}`, {
        slot: c.slot,
        card_id: c.card_id,
        slot_kind: c.slot_kind,
        card_type: null,
        card_traits: [],
        classes: [],
      });
    }

    for (const c of summaryCards) {
      const k = `${c.card_id}:${c.slot_kind}`;
      const prev = byKey.get(k);
      byKey.set(k, {
        slot: prev?.slot ?? null,
        card_id: c.card_id,
        slot_kind: c.slot_kind,
        card_type: c.card_type,
        card_traits: c.card_traits,
        classes: c.classes,
      });
    }

    return [...byKey.values()].sort((a, b) => {
      const aSlot = a.slot ?? Number.MAX_SAFE_INTEGER;
      const bSlot = b.slot ?? Number.MAX_SAFE_INTEGER;
      if (aSlot !== bSlot) return aSlot - bSlot;
      return a.card_id - b.card_id;
    });
  }, [selectedDeckBase, data]);
  const averageElixir = useMemo(() => {
    // Average is based on non-support slots to align with in-battle playable deck cards.
    const costs = mergedCards
      .filter((c) => c.slot_kind !== "support")
      .map((c) => master?.getElixirCost(c.card_id) ?? null)
      .filter((c): c is number => c != null);

    if (costs.length === 0) return null;
    const avg = costs.reduce((sum, c) => sum + c, 0) / costs.length;
    return Math.round(avg * 10) / 10;
  }, [mergedCards, master]);


  return (
    <section className="mx-auto max-w-md space-y-4 px-4 pt-4">
      <div className="space-y-1">
        <div className="text-[22px] font-semibold tracking-tight text-slate-900">Overview</div>
        <div className="text-xs text-slate-500">{playerLabel}</div>

        {!player || !deckKey ? (
          <div className="mt-2 rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-700 shadow-sm">
            Setup is required. Please select <span className="font-semibold">Player</span> and{" "}
            <span className="font-semibold">Deck</span> in Settings.
            <div className="mt-2">
              <button
                onClick={() => nav("/settings")}
                className="inline-flex items-center rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                Open Settings →
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {cardsError ? <ApiErrorPanel title="Cards error" detail={cardsError} /> : null}

      <SyncCard />

      <SectionCard>
        <div className="text-sm font-semibold text-slate-900">Deck identity</div>
        <div className="mt-1 text-xs text-slate-500">
          Understand what this deck is before reading counters/threats.
        </div>

        {err ? (
          <div className="mt-3">
            <ApiErrorPanel title="Summary error" detail={err} />
          </div>
        ) : null}

        {loading || cardsLoading ? <div className="mt-3 text-sm text-slate-500">Loading summary...</div> : null}

        {!loading && !err && data ? (
          <div className="mt-4 space-y-4">
            <div>
              <div className="text-xs text-slate-500">Traits</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.deck_traits.length === 0 ? (
                  <div className="text-sm text-slate-600">No traits.</div>
                ) : (
                  data.deck_traits.map((t) => (
                    <span
                      key={t.trait_key}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                    >
                      {prettyKey(t.trait_key)} · {t.count}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Classes</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.deck_classes.length === 0 ? (
                  <div className="text-sm text-slate-600">No classes.</div>
                ) : (
                  data.deck_classes.map((c) => (
                    <span
                      key={c.class_key}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                    >
                      {prettyKey(c.class_key)} · {c.count}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                <span>Cards</span>
                <span>avg elixir {averageElixir ?? "-"}</span>
              </div>
              <div className="mt-2 space-y-2">
                {mergedCards.length === 0 ? (
                  <div className="text-sm text-slate-600">No cards in this summary.</div>
                ) : (
                  mergedCards.map((c) => {
                    const name = master?.getName(c.card_id) ?? `#${c.card_id}`;
                    const icon = master?.getIconUrl(c.card_id, c.slot_kind) ?? null;

                    return (
                      <div
                        key={`${c.card_id}:${c.slot_kind}`}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 shrink-0">
                            {icon ? (
                              <img src={icon} alt="" className="h-full w-full object-contain" loading="lazy" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">?</div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-slate-900">{name}</div>
                            <div className="mt-0.5 text-xs text-slate-500">
                              slot {c.slot ?? "?"} · {c.slot_kind} · {c.card_type ?? "-"} · elixir {master?.getElixirCost(c.card_id) ?? "-"}
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 grid gap-1 text-xs">
                          <div>
                            <span className="text-slate-500">traits:</span>{" "}
                            <span className="text-slate-700">
                              {c.card_traits.length ? c.card_traits.map(prettyKey).join(", ") : "-"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">classes:</span>{" "}
                            <span className="text-slate-700">
                              {c.classes.length ? c.classes.map(prettyKey).join(", ") : "-"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : null}
      </SectionCard>
    </section>
  );
}
