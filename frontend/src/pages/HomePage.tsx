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

  const sortedCards = useMemo(() => {
    return [...(data?.cards ?? [])].sort((a, b) => a.card_id - b.card_id);
  }, [data]);

  return (
    <section className="mx-auto max-w-md space-y-4 px-4 pt-4">
      <div className="space-y-1">
        <div className="text-[22px] font-semibold tracking-tight text-slate-900">Deck Summary</div>
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
              <div className="text-xs text-slate-500">Cards</div>
              <div className="mt-2 space-y-2">
                {sortedCards.length === 0 ? (
                  <div className="text-sm text-slate-600">No cards in this summary.</div>
                ) : (
                  sortedCards.map((c) => {
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
                              {c.slot_kind} · {c.card_type}
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
