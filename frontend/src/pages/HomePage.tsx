import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelection } from "../lib/selection";
import ApiErrorPanel from "../components/ApiErrorPanel";
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

  const playerLabel = player ? `${player.player_name} (${player.player_tag})` : "(not selected)";

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

  const minimumElixirCycle = useMemo(() => {
    const baseCards = (selectedDeckBase?.cards ?? []).filter((c) => c.slot >= 0 && c.slot <= 7);
    const costs = baseCards
      .map((c) => master?.getElixirCost(c.card_id) ?? null)
      .filter((c): c is number => c != null)
      .sort((a, b) => a - b);

    if (costs.length < 4) return null;
    return costs.slice(0, 4).reduce((sum, c) => sum + c, 0);
  }, [selectedDeckBase, master]);

  const deckIdentityLines = useMemo(() => {
    if (!data) return [];
    const traitCount = (keyIncludes: string) =>
      data.deck_traits
        .filter((t) => t.trait_key.includes(keyIncludes))
        .reduce((sum, t) => sum + t.count, 0);
    const classCount = (keyIncludes: string) =>
      data.deck_classes
        .filter((c) => c.class_key.includes(keyIncludes))
        .reduce((sum, c) => sum + c.count, 0);

    const winConCount = classCount("win_condition");
    const aoeCount = traitCount("aoe");
    const airCount = classCount("anti_air") + traitCount("air");
    const buildingCount = classCount("building");
    const swarmLikeCount = traitCount("swarm");

    const style =
      minimumElixirCycle != null && minimumElixirCycle <= 9
        ? "Cycle"
        : minimumElixirCycle != null && minimumElixirCycle >= 13
          ? "Beatdown"
          : buildingCount >= 2
            ? "Siege"
            : winConCount >= 2 && buildingCount === 0
              ? "Bridge Spam"
              : swarmLikeCount >= 2
                ? "Bait"
                : "Control";

    const speed = minimumElixirCycle == null ? "Unknown" : minimumElixirCycle <= 9 ? "Fast" : minimumElixirCycle <= 12 ? "Mid" : "Slow";
    const aoeRes = aoeCount >= 4 ? "High" : aoeCount >= 2 ? "Medium" : "Low";
    const airRes = airCount >= 3 ? "High" : airCount >= 1 ? "Medium" : "Low";

    return [
      `Deck style: ${style}`,
      `AoE resistance: ${aoeRes}`,
      `Air resistance: ${airRes}`,
      `Cycle speed: ${speed}`,
    ];
  }, [data, minimumElixirCycle]);

  const strengths = useMemo(() => {
    if (!data) return [];
    const xs: string[] = [];
    const countTrait = (keyIncludes: string) =>
      data.deck_traits
        .filter((t) => t.trait_key.includes(keyIncludes))
        .reduce((sum, t) => sum + t.count, 0);
    const countClass = (keyIncludes: string) =>
      data.deck_classes
        .filter((c) => c.class_key.includes(keyIncludes))
        .reduce((sum, c) => sum + c.count, 0);

    const air = countClass("anti_air") + countTrait("air");
    const aoe = countTrait("aoe");
    const winCon = countClass("win_condition");

    if (air >= 3) xs.push("Strong against air cards");
    if (aoe >= 3) xs.push(`Has ${aoe} AoE cards`);
    if (winCon >= 2) xs.push(`Has ${winCon} win condition cards`);
    if (minimumElixirCycle != null && minimumElixirCycle <= 10) xs.push("Fast card rotation");
    if (xs.length < 3) xs.push("Stable role balance");
    return xs.slice(0, 3);
  }, [data, minimumElixirCycle]);

  const weaknesses = useMemo(() => {
    if (!data) return [];
    const xs: string[] = [];
    const countTrait = (keyIncludes: string) =>
      data.deck_traits
        .filter((t) => t.trait_key.includes(keyIncludes))
        .reduce((sum, t) => sum + t.count, 0);
    const countClass = (keyIncludes: string) =>
      data.deck_classes
        .filter((c) => c.class_key.includes(keyIncludes))
        .reduce((sum, c) => sum + c.count, 0);

    const stunResist = countTrait("stun_resist") + countTrait("immobilize_resist");
    const antiSwarm = countTrait("aoe") + countTrait("splash");
    const building = countClass("building");

    if (stunResist === 0) xs.push("May be weak vs immobilize");
    if (antiSwarm <= 1) xs.push("May be weak vs swarm");
    if (building === 0) xs.push("No clear defensive building");
    if (minimumElixirCycle != null && minimumElixirCycle >= 13) xs.push("Heavy cycle can cause slow defense");
    if (xs.length < 3) xs.push("Can lose tempo in mirror matchups");
    return xs.slice(0, 3);
  }, [data, minimumElixirCycle]);

  return (
    <section className="mx-auto max-w-md space-y-4 px-4 pt-4">
      <div className="space-y-1">
        <div className="text-[22px] font-semibold tracking-tight text-slate-900">Overview</div>
        <div className="text-xs text-slate-500">{playerLabel}</div>

        {!player || !deckKey ? (
          <div className="mt-2 rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-700 shadow-sm">
            Setup is required. Please select <span className="font-semibold">Player</span> and <span className="font-semibold">Deck</span> in Settings.
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

      <SectionCard>
        <div className="text-sm font-semibold text-slate-900">1) Deck profile</div>
        <div className="mt-1 text-xs text-slate-500">Simple summary to understand this deck in a few seconds.</div>

        {err ? (
          <div className="mt-3">
            <ApiErrorPanel title="Summary error" detail={err} />
          </div>
        ) : null}

        {loading || cardsLoading ? <div className="mt-3 text-sm text-slate-500">Loading summary...</div> : null}

        {!loading && !err && data ? (
          <div className="mt-4 space-y-4">
            <div className="space-y-1 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
              {deckIdentityLines.map((line) => (
                <div key={line}>- {line}</div>
              ))}
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-700">Strengths (top 3)</div>
              <ul className="mt-2 space-y-1 text-sm text-slate-800">
                {strengths.map((s) => (
                  <li key={s}>✓ {s}</li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-700">Weaknesses (top 3)</div>
              <ul className="mt-2 space-y-1 text-sm text-slate-800">
                {weaknesses.map((w) => (
                  <li key={w}>⚠ {w}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </SectionCard>

      {!loading && !err && data ? (
        <SectionCard>
          <div className="text-sm font-semibold text-slate-900">2) Cards and deck data</div>
          <div className="mt-1 text-xs text-slate-500">Cards are always visible. Click a card to see traits and classes.</div>

          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
            <span>Cards</span>
            <span>Minimum elixir cycle {minimumElixirCycle ?? "-"}</span>
          </div>

          <div className="mt-2 space-y-2">
            {mergedCards.length === 0 ? (
              <div className="text-sm text-slate-600">No cards in this summary.</div>
            ) : (
              mergedCards.map((c) => {
                const name = master?.getName(c.card_id) ?? `#${c.card_id}`;
                const icon = master?.getIconUrl(c.card_id, c.slot_kind) ?? null;
                const isWinCondition = c.classes.some((cl) => cl.includes("win_condition"));

                return (
                  <details
                    key={`${c.card_id}:${c.slot_kind}`}
                    className={`rounded-2xl border px-3 py-2.5 ${isWinCondition ? "border-amber-300 bg-amber-50/60" : "border-slate-200 bg-white"}`}
                  >
                    <summary className="cursor-pointer list-none">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 shrink-0">
                          {icon ? (
                            <img src={icon} alt="" className="h-full w-full object-contain" loading="lazy" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">?</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="truncate text-sm font-semibold text-slate-900">{name}</div>
                            {isWinCondition ? (
                              <span className="rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">WIN CON</span>
                            ) : null}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            slot {c.slot ?? "?"} · {c.slot_kind} · {c.card_type ?? "-"} · elixir {master?.getElixirCost(c.card_id) ?? "-"}
                          </div>
                        </div>
                      </div>
                    </summary>

                    <div className="mt-2 grid gap-1 text-xs">
                      <div>
                        <span className="text-slate-500">traits:</span>{" "}
                        <span className="text-slate-700">{c.card_traits.length ? c.card_traits.map(prettyKey).join(", ") : "-"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">classes:</span>{" "}
                        <span className="text-slate-700">{c.classes.length ? c.classes.map(prettyKey).join(", ") : "-"}</span>
                      </div>
                    </div>
                  </details>
                );
              })
            )}
          </div>

          <details className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
            <summary className="cursor-pointer text-xs font-semibold text-slate-600">Traits and classes summary</summary>
            <div className="mt-3 space-y-4">
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
            </div>
          </details>
        </SectionCard>
      ) : null}
    </section>
  );
}
