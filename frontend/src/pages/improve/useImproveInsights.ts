import { useCallback, useEffect, useMemo, useState } from "react";
import { useCardMaster } from "../../cards/useCardMaster";
import {
  getCommonTraits,
  getDeckDefenseThreats,
  getDeckOffenseCounters,
  getDeckSummary,
  getTrendTraits,
  getTrendWinConditions,
} from "../../api/api";
import type {
  CommonTraitsResponse,
  DeckDefenseThreatsResponse,
  DeckOffenseCountersResponse,
  DeckSummaryResponse,
  TrendTraitsResponse,
  TrendWinConditionsResponse,
} from "../../api/types";
import { toErrorText } from "../../lib/errors";
import type { Player } from "../../lib/types";

export type WhyTab = "attack" | "defense";
type IssueSide = "attack" | "defense";

type CardThumb = { card_id: number; slot_kind: "normal" | "evolution" | "hero" | "support" };

export type Issue = {
  side: IssueSide;
  label: string;
  encounterRate: number;
  deltaVsBaseline: number;
  battles: number;
  expectedLoss: number;
  exampleCards: CardThumb[];
};

export type ActionPlan = {
  id: string;
  title: string;
  reason: string;
  currentState: string;
  checks: string[];
  priority: number;
};

export type OffenseBarItem = {
  key: string;
  label: string;
  envAvgCount: number;
  myDeckCount: number;
  expectedLoss: number;
  deltaVsBaseline: number;
  traitCards: CardThumb[];
};

export type CardMaster = ReturnType<typeof useCardMaster>["master"];

const ISSUE_FILTER = {
  minEncounterRate: 0.15,
  maxEncounterRate: 0.85,
  minDelta: -0.05,
  minBattles: 20,
  maxMeanCount: 2.2,
};

function normalizeSlotKind(v: unknown): CardThumb["slot_kind"] {
  if (v === "normal" || v === "evolution" || v === "hero" || v === "support") return v;
  return "normal";
}

function prettyKey(k: string): string {
  return k.replace(/^is_/, "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function signedPct(v: number): string {
  const raw = Math.round(v * 1000) / 10;
  return `${raw > 0 ? "+" : ""}${raw}%`;
}

function expectedLoss(battles: number, baseline: number, given: number): number {
  return battles * Math.max(0, baseline - given);
}

function traitCount(summary: DeckSummaryResponse | null, keyIncludes: string): number {
  if (!summary) return 0;
  return summary.deck_traits.filter((t) => t.trait_key.includes(keyIncludes)).reduce((sum, t) => sum + t.count, 0);
}

export function useImproveInsights({
  player,
  deckKey,
  master,
}: {
  player: Player | null;
  deckKey: string | null;
  master: CardMaster;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [offense, setOffense] = useState<DeckOffenseCountersResponse | null>(null);
  const [defense, setDefense] = useState<DeckDefenseThreatsResponse | null>(null);
  const [trend, setTrend] = useState<TrendTraitsResponse | null>(null);
  const [summary, setSummary] = useState<DeckSummaryResponse | null>(null);
  const [winConTrend, setWinConTrend] = useState<TrendWinConditionsResponse | null>(null);
  const [commonTraits, setCommonTraits] = useState<CommonTraitsResponse | null>(null);

  useEffect(() => {
    if (!player || !deckKey) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [off, def, tr, sum, wc, ct] = await Promise.all([
          getDeckOffenseCounters(deckKey, 2),
          getDeckDefenseThreats(deckKey, 2),
          getTrendTraits(player.player_tag, 2),
          getDeckSummary(deckKey),
          getTrendWinConditions(player.player_tag, 2),
          getCommonTraits(),
        ]);
        if (cancelled) return;
        setOffense(off);
        setDefense(def);
        setTrend(tr);
        setSummary(sum);
        setWinConTrend(wc);
        setCommonTraits(ct);
      } catch (e) {
        if (!cancelled) setErr(toErrorText(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [player, deckKey]);

  const traitCardMap = useMemo(() => {
    if (!commonTraits) return new Map<string, CardThumb[]>();
    const byTrait = new Map<string, CardThumb[]>();
    for (const row of Array.isArray(commonTraits.traits) ? commonTraits.traits : []) {
      const normalizedCards = (Array.isArray(row.cards) ? row.cards : [])
        .map((c) => ({ card_id: Number(c?.card_id), slot_kind: normalizeSlotKind(c?.slot_kind) }))
        .filter((c) => Number.isFinite(c.card_id))
        .filter((c, idx, arr) => arr.findIndex((x) => x.card_id === c.card_id && x.slot_kind === c.slot_kind) === idx);
      byTrait.set(row.trait_key, normalizedCards);
    }
    return byTrait;
  }, [commonTraits]);

  const traitCardsForKey = useCallback(
    (traitKey: string): CardThumb[] => traitCardMap.get(traitKey) ?? traitCardMap.get(traitKey.startsWith("is_") ? traitKey.slice(3) : `is_${traitKey}`) ?? [],
    [traitCardMap],
  );

  const attackIssue = useMemo<Issue | null>(() => {
    if (!offense || !trend) return null;
    const baseline = offense.summary.baseline_win_rate;
    const hit = offense.counters.traits
      .map((t) => ({ trait: t, meanCount: trend.traits.find((x) => x.trait_key === t.trait_key)?.summary.mean_count ?? 0, loss: expectedLoss(t.stats.battles_with_element, baseline, t.stats.win_rate_given) }))
      .filter((x) => x.trait.stats.encounter_rate >= ISSUE_FILTER.minEncounterRate)
      .filter((x) => x.trait.stats.encounter_rate <= ISSUE_FILTER.maxEncounterRate)
      .filter((x) => x.trait.stats.delta_vs_baseline <= ISSUE_FILTER.minDelta)
      .filter((x) => x.trait.stats.battles_with_element >= ISSUE_FILTER.minBattles)
      .filter((x) => x.meanCount <= ISSUE_FILTER.maxMeanCount)
      .sort((a, b) => b.loss - a.loss)[0];

    return hit
      ? {
          side: "attack",
          label: prettyKey(hit.trait.trait_key),
          encounterRate: hit.trait.stats.encounter_rate,
          deltaVsBaseline: hit.trait.stats.delta_vs_baseline,
          battles: hit.trait.stats.battles_with_element,
          expectedLoss: hit.loss,
          exampleCards: traitCardsForKey(hit.trait.trait_key),
        }
      : null;
  }, [offense, trend, traitCardsForKey]);

  const defenseIssue = useMemo<Issue | null>(() => {
    if (!defense) return null;
    const baseline = defense.summary.baseline_win_rate;
    const hit = defense.threats
      .map((t) => ({ threat: t, loss: expectedLoss(t.stats.battles_with_element, baseline, t.stats.win_rate_given) }))
      .filter((x) => x.threat.stats.encounter_rate >= ISSUE_FILTER.minEncounterRate)
      .filter((x) => x.threat.stats.delta_vs_baseline <= ISSUE_FILTER.minDelta)
      .filter((x) => x.threat.stats.battles_with_element >= ISSUE_FILTER.minBattles)
      .sort((a, b) => b.loss - a.loss)[0];

    return hit
      ? {
          side: "defense",
          label: master?.getName(hit.threat.card_id) ?? `#${hit.threat.card_id}`,
          encounterRate: hit.threat.stats.encounter_rate,
          deltaVsBaseline: hit.threat.stats.delta_vs_baseline,
          battles: hit.threat.stats.battles_with_element,
          expectedLoss: hit.loss,
          exampleCards: [{ card_id: hit.threat.card_id, slot_kind: hit.threat.slot_kind }],
        }
      : null;
  }, [defense, master]);

  const priorityIssue = useMemo(() => (!attackIssue ? defenseIssue : !defenseIssue ? attackIssue : attackIssue.expectedLoss >= defenseIssue.expectedLoss ? attackIssue : defenseIssue), [attackIssue, defenseIssue]);

  const offenseCompare = useMemo<OffenseBarItem[]>(() => {
    if (!offense || !trend || !summary) return [];
    const baseline = offense.summary.baseline_win_rate;
    return offense.counters.traits
      .map((t) => ({
        key: t.trait_key,
        label: prettyKey(t.trait_key),
        envAvgCount: trend.traits.find((x) => x.trait_key === t.trait_key)?.summary.mean_count ?? 0,
        myDeckCount: traitCount(summary, t.trait_key.replace(/^is_/, "")),
        expectedLoss: expectedLoss(t.stats.battles_with_element, baseline, t.stats.win_rate_given),
        deltaVsBaseline: t.stats.delta_vs_baseline,
        traitCards: traitCardsForKey(t.trait_key),
      }))
      .filter((x) => x.expectedLoss > 0)
      .sort((a, b) => b.expectedLoss - a.expectedLoss)
      .slice(0, 4);
  }, [offense, trend, summary, traitCardsForKey]);

  const defenseBars = useMemo(
    () =>
      !defense
        ? []
        : defense.threats
            .map((t) => ({
              key: `${t.card_id}`,
              label: master?.getName(t.card_id) ?? `#${t.card_id}`,
              expectedLoss: expectedLoss(t.stats.battles_with_element, defense.summary.baseline_win_rate, t.stats.win_rate_given),
              encounterRate: t.stats.encounter_rate,
              deltaVsBaseline: t.stats.delta_vs_baseline,
            }))
            .sort((a, b) => b.expectedLoss - a.expectedLoss)
            .slice(0, 5),
    [defense, master],
  );

  const actions = useMemo<ActionPlan[]>(() => {
    if (!summary) return [];
    const xs: ActionPlan[] = [];
    const attackLabel = attackIssue?.label.toLowerCase() ?? "";
    const defenseLabel = defenseIssue?.label ?? "";

    const stunCount = traitCount(summary, "stun") + traitCount(summary, "immobilize");
    if ((attackLabel.includes("stun") || attackLabel.includes("immobilize")) && stunCount <= 1) {
      xs.push({ id: "action-stun", title: "Add more anti-control tools", reason: `Attack issue is ${attackIssue?.label ?? "stun type"} (win-rate delta ${signedPct(attackIssue?.deltaVsBaseline ?? 0)})`, currentState: `Current state: stun/immobilize trait count = ${stunCount}`, checks: ["count failed attacks", "win rate vs stun-style matchups"], priority: attackIssue?.expectedLoss ?? 0 });
    }

    const aoeCount = traitCount(summary, "aoe") + traitCount(summary, "splash") + traitCount(summary, "area");
    if ((attackLabel.includes("swarm") || attackLabel.includes("bait")) && aoeCount <= 1) {
      xs.push({ id: "action-aoe", title: "Add one stronger AoE option", reason: `Attack issue is ${attackIssue?.label ?? "swarm/bait"} as a blocker`, currentState: `Current state: AoE-related trait count = ${aoeCount}`, checks: ["count failed swarm clears", "spell hold success rate"], priority: (attackIssue?.expectedLoss ?? 0) * 0.95 });
    }

    const buildingCount = summary.cards.filter((c) => c.card_type === "building").length;
    if (defenseIssue && buildingCount === 0) {
      xs.push({ id: "action-defense", title: "Add one dedicated defense slot (building/high DPS)", reason: `Defense issue is ${defenseLabel} (win-rate delta ${signedPct(defenseIssue.deltaVsBaseline)})`, currentState: `Current state: building card count = ${buildingCount}`, checks: ["damage taken after first push", "counter-push success rate"], priority: defenseIssue.expectedLoss });
    }

    const avgCost = summary.cards.reduce((sum, c) => sum + (master?.getElixirCost(c.card_id) ?? 0), 0) / Math.max(summary.cards.length, 1);
    if (avgCost > 4.3) {
      xs.push({ id: "action-cost", title: "Lower average elixir cost by ~0.2", reason: `Current average cost is ${avgCost.toFixed(2)} and can cause delayed response windows`, currentState: `Current state: avg cost ${avgCost.toFixed(2)}`, checks: ["late defense failures", "unused elixir overflow events"], priority: 8 });
    }

    if (!xs.length) {
      xs.push({ id: "action-generic", title: "Run a 5-match focused review", reason: "No high-confidence single fix detected from current sample", currentState: "Current state: mixed signals", checks: ["first major mistake timing", "loss pattern by matchup type"], priority: 1 });
    }

    return xs.sort((a, b) => b.priority - a.priority).slice(0, 3);
  }, [summary, attackIssue, defenseIssue, master]);

  const trendTopWinCons = useMemo(
    () =>
      !winConTrend
        ? []
        : winConTrend.cards.slice(0, 3).map((c) => ({ name: master?.getName(c.card_id) ?? `#${c.card_id}`, rate: c.fractional_points / (winConTrend.total_points || 1) })),
    [winConTrend, master],
  );

  return { loading, err, attackIssue, defenseIssue, priorityIssue, offenseCompare, defenseBars, actions, trendTopWinCons };
}
