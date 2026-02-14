import { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/SectionCard";
import ApiErrorPanel from "../components/ApiErrorPanel";
import { useSelection } from "../lib/selection";
import { useCardMaster } from "../cards/useCardMaster";
import { useCommonPlayers } from "../lib/commonPlayers";
import { toErrorText } from "../lib/errors";
import {
  getDeckDefenseThreats,
  getDeckOffenseCounters,
  getDeckSummary,
  getTrendTraits,
  getTrendWinConditions,
  getCommonTraits,
} from "../api/api";
import type {
  DeckDefenseThreatsResponse,
  DeckOffenseCountersResponse,
  DeckSummaryResponse,
  TrendTraitsResponse,
  TrendWinConditionsResponse,
  CommonTraitsResponse,
} from "../api/types";

type WhyTab = "attack" | "defense";
type IssueSide = "attack" | "defense";

type CardThumb = {
  card_id: number;
  slot_kind: "normal" | "evolution" | "hero" | "support";
};

type Issue = {
  side: IssueSide;
  label: string;
  encounterRate: number;
  deltaVsBaseline: number;
  battles: number;
  expectedLoss: number;
  exampleCards: CardThumb[];
};

type ActionPlan = {
  id: string;
  title: string;
  reason: string;
  currentState: string;
  checks: string[];
  priority: number;
};

type OffenseBarItem = {
  key: string;
  label: string;
  envAvgCount: number;
  myDeckCount: number;
  expectedLoss: number;
  deltaVsBaseline: number;
  traitCards: CardThumb[];
};

const ISSUE_FILTER = {
  minEncounterRate: 0.15,
  maxEncounterRate: 0.85,
  minDelta: -0.05,
  minBattles: 20,
  maxMeanCount: 2.2,
};

function prettyKey(k: string): string {
  return k.replace(/^is_/, "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function pct(v: number): string {
  return `${Math.round(v * 1000) / 10}%`;
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

function cardExamplesForTrait(traitKey: string, offense: DeckOffenseCountersResponse | null, master: ReturnType<typeof useCardMaster>["master"]): CardThumb[] {
  if (!offense) return [];

  const key = traitKey.toLowerCase();
  const cardName = (id: number) => (master?.getName(id) ?? `#${id}`).toLowerCase();

  const matched = offense.counters.cards
    .filter((c) => {
      const n = cardName(c.card_id);
      if (key.includes("stun") || key.includes("immobilize")) {
        return n.includes("zap") || n.includes("electro") || n.includes("ice") || n.includes("spirit");
      }
      if (key.includes("swarm") || key.includes("bait") || key.includes("air")) {
        return n.includes("arrow") || n.includes("fireball") || n.includes("log") || n.includes("wizard") || n.includes("dragon");
      }
      return true;
    })
    .sort((a, b) => b.stats.encounter_rate - a.stats.encounter_rate)
    .slice(0, 2)
    .map((c) => ({ card_id: c.card_id, slot_kind: c.slot_kind }));

  return matched;
}

function CardThumbGrid({ cards, master }: { cards: CardThumb[]; master: ReturnType<typeof useCardMaster>["master"] }) {
  if (!cards.length) return <div className="text-xs text-slate-500">No cards.</div>;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {cards.map((c) => {
        const icon = master?.getIconUrl(c.card_id, c.slot_kind) ?? null;
        const name = master?.getName(c.card_id) ?? `#${c.card_id}`;
        return (
          <div key={`${c.card_id}:${c.slot_kind}`} className="h-10 w-10 overflow-hidden rounded-lg border border-slate-200 bg-white" title={`${name} (${c.slot_kind})`}>
            {icon ? <img src={icon} alt={name} className="h-full w-full object-contain" loading="lazy" /> : <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">?</div>}
          </div>
        );
      })}
    </div>
  );
}

function OffenseCompareBars({ items, master }: { items: OffenseBarItem[]; master: ReturnType<typeof useCardMaster>["master"] }) {
  if (!items.length) return <div className="text-xs text-slate-500">Not enough data to show this yet.</div>;
  const maxEnv = Math.max(...items.map((i) => i.envAvgCount), 0.001);
  const maxMy = Math.max(...items.map((i) => i.myDeckCount), 0.001);

  return (
    <div className="mt-2 space-y-3">
      {items.map((i) => (
        <div key={i.key} className="rounded-xl border border-slate-200 bg-white p-2">
          <div className="text-xs font-semibold text-slate-900">{i.label}</div>
          <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
            <div>
              <div>Meta average {i.envAvgCount.toFixed(2)} cards</div>
              <div className="mt-1 h-1.5 rounded bg-slate-100">
                <div className="h-full rounded bg-indigo-500" style={{ width: `${(i.envAvgCount / maxEnv) * 100}%` }} />
              </div>
            </div>
            <div>
              <div>Your deck {i.myDeckCount} cards</div>
              <div className="mt-1 h-1.5 rounded bg-slate-100">
                <div className="h-full rounded bg-emerald-500" style={{ width: `${(i.myDeckCount / Math.max(maxMy, 1)) * 100}%` }} />
              </div>
            </div>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Win-rate delta {signedPct(i.deltaVsBaseline)} / EL {i.expectedLoss.toFixed(1)}</div>
          {i.traitCards.length ? (
            <details className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
              <summary className="cursor-pointer text-[11px] font-semibold text-slate-600">Trait cards</summary>
              <CardThumbGrid cards={i.traitCards} master={master} />
            </details>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function DefenseBars({
  items,
}: {
  items: Array<{ key: string; label: string; expectedLoss: number; encounterRate: number; deltaVsBaseline: number }>;
}) {
  if (!items.length) return <div className="text-xs text-slate-500">Not enough data to show this yet.</div>;
  const maxLoss = Math.max(...items.map((x) => x.expectedLoss), 0.001);

  return (
    <div className="mt-2 space-y-2">
      {items.map((x) => (
        <div key={x.key}>
          <div className="flex items-center justify-between text-xs text-slate-700">
            <span>{x.label}</span>
            <span>EL {x.expectedLoss.toFixed(1)} / Win-rate delta {signedPct(x.deltaVsBaseline)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-rose-500" style={{ width: `${(x.expectedLoss / maxLoss) * 100}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Encounter {pct(x.encounterRate)}</div>
        </div>
      ))}
    </div>
  );
}

export default function ImprovePage() {
  const { player, deckKey } = useSelection();
  const { master } = useCardMaster();
  const { data: playersData } = useCommonPlayers();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [offense, setOffense] = useState<DeckOffenseCountersResponse | null>(null);
  const [defense, setDefense] = useState<DeckDefenseThreatsResponse | null>(null);
  const [trend, setTrend] = useState<TrendTraitsResponse | null>(null);
  const [summary, setSummary] = useState<DeckSummaryResponse | null>(null);
  const [winConTrend, setWinConTrend] = useState<TrendWinConditionsResponse | null>(null);
  const [commonTraits, setCommonTraits] = useState<CommonTraitsResponse | null>(null);
  const [whyTab, setWhyTab] = useState<WhyTab>("attack");
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);

  useEffect(() => {
    if (!player || !deckKey) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setErr(null);
      setSelectedActionId(null);
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
    const traits = Array.isArray(commonTraits.traits) ? commonTraits.traits : [];
    for (const row of traits) {
      const cards = Array.isArray(row.cards) ? row.cards : [];
      const normalized = cards
        .filter((c): c is CardThumb => Number.isFinite(c?.card_id) && typeof c?.slot_kind === "string")
        .filter((c, idx, arr) => arr.findIndex((x) => x.card_id === c.card_id && x.slot_kind === c.slot_kind) === idx);

      byTrait.set(row.trait_key, normalized);
    }
    return byTrait;
  }, [commonTraits]);

  const attackIssue = useMemo<Issue | null>(() => {
    if (!offense || !trend) return null;
    const baseline = offense.summary.baseline_win_rate;

    const hit = offense.counters.traits
      .map((t) => {
        const meanCount = trend.traits.find((x) => x.trait_key === t.trait_key)?.summary.mean_count ?? 0;
        return {
          trait: t,
          meanCount,
          loss: expectedLoss(t.stats.battles_with_element, baseline, t.stats.win_rate_given),
        };
      })
      .filter((x) => x.trait.stats.encounter_rate >= ISSUE_FILTER.minEncounterRate)
      .filter((x) => x.trait.stats.encounter_rate <= ISSUE_FILTER.maxEncounterRate)
      .filter((x) => x.trait.stats.delta_vs_baseline <= ISSUE_FILTER.minDelta)
      .filter((x) => x.trait.stats.battles_with_element >= ISSUE_FILTER.minBattles)
      .filter((x) => x.meanCount <= ISSUE_FILTER.maxMeanCount)
      .sort((a, b) => b.loss - a.loss)[0];

    if (!hit) return null;
    return {
      side: "attack",
      label: prettyKey(hit.trait.trait_key),
      encounterRate: hit.trait.stats.encounter_rate,
      deltaVsBaseline: hit.trait.stats.delta_vs_baseline,
      battles: hit.trait.stats.battles_with_element,
      expectedLoss: hit.loss,
      exampleCards: traitCardMap.get(hit.trait.trait_key) ?? cardExamplesForTrait(hit.trait.trait_key, offense, master),
    };
  }, [offense, trend, master, traitCardMap]);

  const defenseIssue = useMemo<Issue | null>(() => {
    if (!defense) return null;
    const baseline = defense.summary.baseline_win_rate;

    const hit = defense.threats
      .map((t) => ({
        threat: t,
        loss: expectedLoss(t.stats.battles_with_element, baseline, t.stats.win_rate_given),
      }))
      .filter((x) => x.threat.stats.encounter_rate >= ISSUE_FILTER.minEncounterRate)
      .filter((x) => x.threat.stats.delta_vs_baseline <= ISSUE_FILTER.minDelta)
      .filter((x) => x.threat.stats.battles_with_element >= ISSUE_FILTER.minBattles)
      .sort((a, b) => b.loss - a.loss)[0];

    if (!hit) return null;
    return {
      side: "defense",
      label: master?.getName(hit.threat.card_id) ?? `#${hit.threat.card_id}`,
      encounterRate: hit.threat.stats.encounter_rate,
      deltaVsBaseline: hit.threat.stats.delta_vs_baseline,
      battles: hit.threat.stats.battles_with_element,
      expectedLoss: hit.loss,
      exampleCards: [{ card_id: hit.threat.card_id, slot_kind: hit.threat.slot_kind }],
    };
  }, [defense, master]);

  const priorityIssue = useMemo(() => {
    if (!attackIssue) return defenseIssue;
    if (!defenseIssue) return attackIssue;
    return attackIssue.expectedLoss >= defenseIssue.expectedLoss ? attackIssue : defenseIssue;
  }, [attackIssue, defenseIssue]);

  const offenseCompare = useMemo<OffenseBarItem[]>(() => {
    if (!offense || !trend || !summary) return [];
    const baseline = offense.summary.baseline_win_rate;
    return offense.counters.traits
      .map((t) => {
        const tr = trend.traits.find((x) => x.trait_key === t.trait_key);
        return {
          key: t.trait_key,
          label: prettyKey(t.trait_key),
          envAvgCount: tr?.summary.mean_count ?? 0,
          myDeckCount: traitCount(summary, t.trait_key.replace(/^is_/, "")),
          expectedLoss: expectedLoss(t.stats.battles_with_element, baseline, t.stats.win_rate_given),
          deltaVsBaseline: t.stats.delta_vs_baseline,
          traitCards: traitCardMap.get(t.trait_key) ?? [],
        };
      })
      .filter((x) => x.expectedLoss > 0)
      .sort((a, b) => b.expectedLoss - a.expectedLoss)
      .slice(0, 4);
  }, [offense, trend, summary, traitCardMap]);

  const defenseBars = useMemo(() => {
    if (!defense) return [];
    const baseline = defense.summary.baseline_win_rate;
    return defense.threats
      .map((t) => ({
        key: `${t.card_id}`,
        label: master?.getName(t.card_id) ?? `#${t.card_id}`,
        expectedLoss: expectedLoss(t.stats.battles_with_element, baseline, t.stats.win_rate_given),
        encounterRate: t.stats.encounter_rate,
        deltaVsBaseline: t.stats.delta_vs_baseline,
      }))
      .sort((a, b) => b.expectedLoss - a.expectedLoss)
      .slice(0, 5);
  }, [defense, master]);

  const actions = useMemo<ActionPlan[]>(() => {
    if (!summary) return [];
    const xs: ActionPlan[] = [];
    const attackLabel = attackIssue?.label.toLowerCase() ?? "";
    const defenseLabel = defenseIssue?.label ?? "";

    const stunCount = traitCount(summary, "stun") + traitCount(summary, "immobilize");
    if ((attackLabel.includes("stun") || attackLabel.includes("immobilize")) && stunCount <= 1) {
      xs.push({
        id: "action-stun",
        title: "Add more anti-control tools",
        reason: `Attack issue is ${attackIssue?.label ?? "stun type"} (win-rate delta ${signedPct(attackIssue?.deltaVsBaseline ?? 0)})`,
        currentState: `Current state: stun/immobilize trait count = ${stunCount}`,
        checks: ["count failed attacks", "win rate vs stun-style matchups"],
        priority: attackIssue?.expectedLoss ?? 0,
      });
    }

    const aoeCount = traitCount(summary, "aoe") + traitCount(summary, "splash") + traitCount(summary, "area");
    if ((attackLabel.includes("swarm") || attackLabel.includes("bait")) && aoeCount <= 1) {
      xs.push({
        id: "action-aoe",
        title: "Add one stronger AoE option",
        reason: `Attack issue is ${attackIssue?.label ?? "swarm/bait"}  as a blocker`,
        currentState: `Current state: AoE-related trait count = ${aoeCount}`,
        checks: ["count failed swarm clears", "spell hold success rate"],
        priority: (attackIssue?.expectedLoss ?? 0) * 0.95,
      });
    }

    const buildingCount = summary.cards.filter((c) => c.card_type === "building").length;
    if (defenseIssue && buildingCount === 0) {
      xs.push({
        id: "action-defense",
        title: "Add one dedicated defense slot (building/high DPS)",
        reason: `Defense issue is ${defenseLabel} (win-rate delta ${signedPct(defenseIssue.deltaVsBaseline)})`,
        currentState: `Current state: building card count = ${buildingCount}`,
        checks: [`win rate vs ${defenseLabel}`, "defensive hold success rate"],
        priority: defenseIssue.expectedLoss,
      });
    }

    if (xs.length === 0) {
      xs.push({
        id: "action-fallback",
        title: "Pick one failure pattern from the top issue and test it",
        reason: "No clear shortage category yet, so start from one fixed failure pattern.",
        currentState: "Current state: Review last 5 matches: pick 2 attack failures and 2 defense failures",
        checks: ["repeat rate of the same failure", "win-rate delta after changes"],
        priority: 0,
      });
    }

    return xs.sort((a, b) => b.priority - a.priority).slice(0, 3);
  }, [summary, attackIssue, defenseIssue]);

  const selectedAction = useMemo(() => actions.find((a) => a.id === selectedActionId) ?? null, [actions, selectedActionId]);

  const trendTopWinCons = useMemo(() => {
    if (!winConTrend) return [];
    const total = winConTrend.total_points || 1;
    return winConTrend.cards.slice(0, 3).map((c) => ({
      name: master?.getName(c.card_id) ?? `#${c.card_id}`,
      rate: c.fractional_points / total,
    }));
  }, [winConTrend, master]);

  const playerLabel = useMemo(() => {
    if (!player) return "(not selected)";
    const selectedPlayer = playersData?.players.find((p) => p.player_tag === player.player_tag);
    const selectedDeck = selectedPlayer?.decks.find((d) => d.my_deck_key === deckKey);
    const deckName = selectedDeck?.deck_name?.trim() ? selectedDeck.deck_name : "No Name";
    return `${player.player_name} (${player.player_tag}) - ${deckName}`;
  }, [deckKey, player, playersData]);

  const issueLine = priorityIssue
    ? priorityIssue.side === "attack"
      ? `Your attack is often stopped by ${priorityIssue.label} (win-rate ${signedPct(priorityIssue.deltaVsBaseline)})`
      : `Your defense often breaks against ${priorityIssue.label} (win-rate ${signedPct(priorityIssue.deltaVsBaseline)})`
    : "Not enough data to decide a top priority";

  return (
    <section className="mx-auto max-w-md space-y-4 px-4 pt-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">Improve</h1>
        <div className="mt-1 text-xs text-slate-500">{playerLabel}</div>
      </div>

      {err ? <ApiErrorPanel detail={err} /> : null}
      {loading ? <SectionCard><div className="text-sm text-slate-500">Loading improve insights...</div></SectionCard> : null}

      {!loading && !err ? (
        <>
          <SectionCard>
            <div className="text-sm font-semibold text-slate-900">Issue</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{issueLine}</div>
            <div className="mt-1 text-xs text-slate-600">Attack Issue: {attackIssue ? `${attackIssue.label} / EL ${attackIssue.expectedLoss.toFixed(1)}` : "Not enough data"}</div>
            <div className="mt-1 text-xs text-slate-600">Defense Issue: {defenseIssue ? `${defenseIssue.label} / EL ${defenseIssue.expectedLoss.toFixed(1)}` : "Not enough data"}</div>
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Decision: Prioritize {priorityIssue?.side === "defense" ? "Defense" : "Attack"} first
              {priorityIssue ? ` (encounter ${pct(priorityIssue.encounterRate)} / battles ${priorityIssue.battles})` : ""}
            </div>
            {priorityIssue?.exampleCards.length ? (
              <details className="mt-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                <summary className="cursor-pointer text-xs font-semibold text-slate-600">Example cards</summary>
                <CardThumbGrid cards={priorityIssue.exampleCards} master={master} />
              </details>
            ) : null}
            <details className="mt-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
              <summary className="cursor-pointer text-xs font-semibold text-slate-600">How to read Issue / EL</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
                <li>EL means expected loss: larger value = bigger likely impact on wins.</li>
                <li>Attack and Defense are ranked separately, then compared for one final priority.</li>
                <li>Issue filters remove always-on or low-confidence signals.</li>
              </ul>
            </details>
          </SectionCard>

          <SectionCard>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Why</div>
              <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-xs">
                <button
                  onClick={() => setWhyTab("attack")}
                  className={`rounded-lg px-2 py-1 ${whyTab === "attack" ? "bg-white text-slate-900" : "text-slate-600"}`}
                >
                  Attack
                </button>
                <button
                  onClick={() => setWhyTab("defense")}
                  className={`rounded-lg px-2 py-1 ${whyTab === "defense" ? "bg-white text-slate-900" : "text-slate-600"}`}
                >
                  Defense
                </button>
              </div>
            </div>

            {whyTab === "attack" ? (
              <>
                <OffenseCompareBars items={offenseCompare} master={master} />
              </>
            ) : (
              <>
                <DefenseBars items={defenseBars} />
              </>
            )}

            {trendTopWinCons.length ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                Meta win conditions Top 3: {trendTopWinCons.map((x) => `${x.name} ${pct(x.rate)}`).join(" / ")}
              </div>
            ) : null}
            <details className="mt-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
              <summary className="cursor-pointer text-xs font-semibold text-slate-600">How to read Why</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
                <li>Attack tab compares meta average count vs your deck count per trait.</li>
                <li>Defense tab ranks threats by EL, with win-rate delta and encounter rate.</li>
              </ul>
            </details>
          </SectionCard>

          <SectionCard>
            <div className="text-sm font-semibold text-slate-900">Action</div>
            {selectedAction ? (
              <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                Pinned note: {selectedAction.title}
              </div>
            ) : null}
            <div className="mt-3 space-y-3">
              {actions.map((a) => (
                <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-sm font-semibold text-slate-900">{a.title}</div>
                  <div className="mt-1 text-xs text-slate-600">Why now: {a.reason}</div>
                  <div className="mt-1 text-xs text-slate-500">{a.currentState}</div>
                  <div className="mt-1 text-[11px] text-slate-500">Validate in the next 5 matches: {a.checks.join(" / ")}</div>
                  <button
                    onClick={() => setSelectedActionId(a.id)}
                    className={`mt-2 rounded-xl px-3 py-1.5 text-xs font-medium ${selectedActionId === a.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                  >
                    Select
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-slate-500">Suggestions are based on statistical correlation, not guaranteed causation.</div>
            <details className="mt-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
              <summary className="cursor-pointer text-xs font-semibold text-slate-600">What to keep / cut</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
                <li>Keep: one selected plan and two validation checks.</li>
                <li>Cut: extra plan details that do not change your next 5-match test.</li>
              </ul>
            </details>
          </SectionCard>
        </>
      ) : null}
    </section>
  );
}
