import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sync, getPriority, getOpponentTrendLast } from "../api/api";
import type { PriorityResponse, OpponentTrendResponse, SyncResponse } from "../api/types";
import { useSelection } from "../lib/selection";
import { toErrorText } from "../lib/errors";
import { useCardMaster } from "../cards/useCardMaster";
import ApiErrorPanel from "../components/ApiErrorPanel";

type Thumb = { card_id: number; slot_kind: "normal" | "evolution" | "hero" | "support" };

function cx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

export default function HomePage() {
  const nav = useNavigate();
  const { player, deckKey } = useSelection();
  const { master, loading: cardsLoading, error: cardsError } = useCardMaster();

  const last = 500;

  // --- Sync ---
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncRes, setSyncRes] = useState<SyncResponse | null>(null);
  const [syncErr, setSyncErr] = useState<string | null>(null);

  // --- Priority top ---
  const [pLoading, setPLoading] = useState(false);
  const [pErr, setPErr] = useState<string | null>(null);
  const [pData, setPData] = useState<PriorityResponse | null>(null);

  // --- Trend top ---
  const [tLoading, setTLoading] = useState(false);
  const [tErr, setTErr] = useState<string | null>(null);
  const [tData, setTData] = useState<OpponentTrendResponse | null>(null);

  // Load Priority + Trend after first paint (asynchronous)
  useEffect(() => {
    if (!player) return;

    // Priority needs player + deck
    if (deckKey) {
      void (async () => {
        setPLoading(true);
        setPErr(null);
        try {
          const res = await getPriority(player.player_tag, deckKey, last);
          res.cards.sort((a, b) => b.priority_score - a.priority_score);
          setPData(res);
        } catch (e) {
          setPErr(toErrorText(e));
        } finally {
          setPLoading(false);
        }
      })();
    } else {
      setPData(null);
    }

    // Trend needs player
    void (async () => {
      setTLoading(true);
      setTErr(null);
      try {
        const res = await getOpponentTrendLast(player.player_tag, last);
        res.cards.sort((a, b) => b.usage_rate - a.usage_rate);
        setTData(res);
      } catch (e) {
        setTErr(toErrorText(e));
      } finally {
        setTLoading(false);
      }
    })();
  }, [player, deckKey]);

  const priorityTop: Thumb[] = useMemo(() => {
    const cards = pData?.cards ?? [];
    return cards.slice(0, 5).map((c) => ({ card_id: c.card_id, slot_kind: c.slot_kind }));
  }, [pData]);

  const trendTop: Thumb[] = useMemo(() => {
    const cards = tData?.cards ?? [];
    return cards.slice(0, 5).map((c) => ({ card_id: c.card_id, slot_kind: c.slot_kind }));
  }, [tData]);

  const playerLabel = player ? `${player.player_name} (${player.player_tag})` : "(not selected)";

  return (
    <section className="mx-auto max-w-md space-y-4 px-4 pt-4">
      {/* Header */}
      <div className="space-y-1">
        <div className="text-[22px] font-semibold tracking-tight text-slate-900">Home</div>
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

      {/* Global errors (cards master) */}
      {cardsError ? <ApiErrorPanel title="Cards error" detail={cardsError} /> : null}

      {/* Sync card */}
      <div className="rounded-[22px] border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Sync</div>
          <div className="text-xs text-slate-500">POST /api/sync</div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            disabled={!player || syncLoading}
            onClick={() => {
              if (!player) return;
              void (async () => {
                setSyncLoading(true);
                setSyncErr(null);
                setSyncRes(null);
                try {
                  const res = await sync(player.player_tag);
                  setSyncRes(res);
                } catch (e) {
                  setSyncErr(toErrorText(e));
                } finally {
                  setSyncLoading(false);
                }
              })();
            }}
            className={cx(
              "rounded-xl px-4 py-2 text-sm font-semibold shadow-sm",
              "transition",
              !player || syncLoading
                ? "bg-slate-200 text-slate-500"
                : "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.99]"
            )}
          >
            {syncLoading ? "Syncing..." : "Sync now"}
          </button>

          <div className="text-xs text-slate-500">{syncLoading ? "Working..." : null}</div>
        </div>

        {syncErr ? (
          <div className="mt-3">
            <ApiErrorPanel detail={syncErr} />
          </div>
        ) : null}

        {syncRes ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs text-slate-500">Result</div>
            <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] text-slate-700">
              {JSON.stringify(syncRes, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>

      {/* Priority preview */}
      <div className="rounded-[22px] border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Priority</div>
          <button
            onClick={() => nav("/priority")}
            className="text-xs font-medium text-blue-700 hover:text-blue-800"
          >
            Open →
          </button>
        </div>

        <div className="mt-2 text-xs text-slate-500">last={last} · top 5 cards</div>

        {pErr ? (
          <div className="mt-3">
            <ApiErrorPanel detail={pErr} />
          </div>
        ) : null}

        {!deckKey ? (
          <div className="mt-3 text-sm text-slate-600">Select a deck in Settings to see Priority.</div>
        ) : null}

        <div className="mt-3">
          {pLoading || cardsLoading ? (
            <div className="text-sm text-slate-500">Loading...</div>
          ) : priorityTop.length === 0 && deckKey ? (
            <div className="text-sm text-slate-600">No priority data.</div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {priorityTop.map((c) => {
                const name = master?.getName(c.card_id) ?? `#${c.card_id}`;
                const icon = master?.getIconUrl(c.card_id, c.slot_kind) ?? null;

                return (
                  <div key={`${c.card_id}:${c.slot_kind}`} className="shrink-0">
                    <div className="h-14 w-14 rounded-2xl border border-slate-200 bg-white shadow-sm">
                      {icon ? (
                        <img
                          src={icon}
                          alt={name}
                          className="h-full w-full rounded-2xl object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-[10px] text-slate-500">
                          #{c.card_id}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Trend preview */}
      <div className="rounded-[22px] border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Trend</div>
          <button
            onClick={() => nav("/trend")}
            className="text-xs font-medium text-blue-700 hover:text-blue-800"
          >
            Open →
          </button>
        </div>

        <div className="mt-2 text-xs text-slate-500">last={last} · top 5 cards</div>

        {tErr ? (
          <div className="mt-3">
            <ApiErrorPanel detail={tErr} />
          </div>
        ) : null}

        <div className="mt-3">
          {tLoading || cardsLoading ? (
            <div className="text-sm text-slate-500">Loading...</div>
          ) : trendTop.length === 0 ? (
            <div className="text-sm text-slate-600">No trend data.</div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {trendTop.map((c) => {
                const name = master?.getName(c.card_id) ?? `#${c.card_id}`;
                const icon = master?.getIconUrl(c.card_id, c.slot_kind) ?? null;

                return (
                  <div key={`${c.card_id}:${c.slot_kind}`} className="shrink-0">
                    <div className="h-14 w-14 rounded-2xl border border-slate-200 bg-white shadow-sm">
                      {icon ? (
                        <img
                          src={icon}
                          alt={name}
                          className="h-full w-full rounded-2xl object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-[10px] text-slate-500">
                          #{c.card_id}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Spacer for bottom nav */}
      <div style={{ height: "calc(92px + var(--safe-bottom))" }} />
    </section>
  );
}
