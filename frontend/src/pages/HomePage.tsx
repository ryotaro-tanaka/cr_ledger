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

  const deckIdentityLines = useMemo(() => {
    if (!data) return [];
    const traitCount = (keyIncludes: string) =>
      data.deck_traits
        .filter((t) => t.trait_key.includes(keyIncludes))
        .reduce((sum, t) => sum + t.count, 0);

    const winConCount = traitCount("win_condition");
    const aoeCount = traitCount("aoe");
    const airCount = traitCount("anti_air") + traitCount("air");

    const speed = averageElixir == null ? "不明" : averageElixir <= 3.1 ? "高速" : averageElixir <= 4.0 ? "中速" : "低速";
    const style = winConCount >= 2 ? "Bridge Spam寄り" : aoeCount >= 3 ? "Control寄り" : "Balanced寄り";
    const aoeRes = aoeCount >= 4 ? "高め" : aoeCount >= 2 ? "普通" : "低め";
    const airRes = airCount >= 3 ? "高め" : airCount >= 1 ? "普通" : "低め";

    return [
      `このデッキは ${style}`,
      `AoE耐性は ${aoeRes}`,
      `Air耐性は ${airRes}`,
      `サイクル速度は ${speed}`,
    ];
  }, [data, averageElixir]);

  const strengths = useMemo(() => {
    if (!data) return [];
    const xs: string[] = [];
    const countTrait = (keyIncludes: string) =>
      data.deck_traits
        .filter((t) => t.trait_key.includes(keyIncludes))
        .reduce((sum, t) => sum + t.count, 0);

    const air = countTrait("anti_air") + countTrait("air");
    const aoe = countTrait("aoe");
    const winCon = countTrait("win_condition");

    if (air >= 3) xs.push("Airへの対応力が高い");
    if (aoe >= 3) xs.push(`AoEを${aoe}枚持つ`);
    if (winCon >= 2) xs.push(`Win Conditionが${winCon}枚`);
    if (averageElixir != null && averageElixir <= 3.3) xs.push("回転が速く主導権を取りやすい");
    if (xs.length < 3) xs.push("カード役割の重複が少なく安定しやすい");
    return xs.slice(0, 3);
  }, [data, averageElixir]);

  const weaknesses = useMemo(() => {
    if (!data) return [];
    const xs: string[] = [];
    const countTrait = (keyIncludes: string) =>
      data.deck_traits
        .filter((t) => t.trait_key.includes(keyIncludes))
        .reduce((sum, t) => sum + t.count, 0);
    const classCount = (keyIncludes: string) =>
      data.deck_classes
        .filter((c) => c.class_key.includes(keyIncludes))
        .reduce((sum, c) => sum + c.count, 0);

    const stunResist = countTrait("stun_resist") + countTrait("immobilize_resist");
    const antiSwarm = countTrait("aoe") + countTrait("splash");
    const building = classCount("building");

    if (stunResist === 0) xs.push("Immobilizeに弱い可能性がある");
    if (antiSwarm <= 1) xs.push("Swarm対策が薄い");
    if (building === 0) xs.push("受けの建物が少ない");
    if (averageElixir != null && averageElixir >= 4.3) xs.push("重め構成で受け遅れリスクがある");
    if (xs.length < 3) xs.push("同系統マッチで後手になりやすい");
    return xs.slice(0, 3);
  }, [data, averageElixir]);

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
        <div className="text-sm font-semibold text-slate-900">デッキの性格（5秒サマリー）</div>
        <div className="mt-1 text-xs text-slate-500">改善前に、まずこのデッキの現在地を1画面で把握します。</div>

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
              <div className="text-xs font-semibold text-slate-700">強み（3つ）</div>
              <ul className="mt-2 space-y-1 text-sm text-slate-800">
                {strengths.map((s) => (
                  <li key={s}>✓ {s}</li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-700">弱み（3つ）</div>
              <ul className="mt-2 space-y-1 text-sm text-slate-800">
                {weaknesses.map((w) => (
                  <li key={w}>⚠ {w}</li>
                ))}
              </ul>
            </div>

            <details className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
              <summary className="cursor-pointer text-xs font-semibold text-slate-600">詳細（traits / classes / cards）</summary>
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
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </details>
          </div>
        ) : null}
      </SectionCard>
    </section>
  );
}
