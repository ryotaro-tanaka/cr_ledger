import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelection } from "../lib/selection";
import ApiErrorPanel from "../components/ApiErrorPanel";
import { getDeckSummary } from "../api/api";
import type { DeckSummaryResponse } from "../api/types";
import { useCardMaster } from "../cards/useCardMaster";
import { toErrorText } from "../lib/errors";
import { useCommonPlayers } from "../lib/commonPlayers";
import DeckProfileSection from "./overview/DeckProfileSection";
import DeckDataSection from "./overview/DeckDataSection";

type MergedCard = {
  slot: number | null;
  card_id: number;
  slot_kind: "normal" | "evolution" | "hero" | "support";
  card_type: "unit" | "spell" | "building" | "support" | null;
  card_traits: string[];
  classes: string[];
};

type DeckTypeKey = "cycle" | "bait" | "beatdown" | "control" | "siege" | "bridge_spam";

const DECK_TYPE_LABEL: Record<DeckTypeKey, string> = {
  cycle: "Cycle",
  bait: "Bait",
  beatdown: "Beatdown",
  control: "Control",
  siege: "Siege",
  bridge_spam: "Bridge Spam",
};

const TACTICAL_GUIDE: Record<DeckTypeKey, string[]> = {
  cycle: [
    "Defend efficiently with low-cost cards and keep reapplying chip pressure.",
    "Do not overspend on defense; always preserve elixir for the next cycle.",
    "Prioritize repeated positive trades over one all-in push.",
  ],
  bait: [
    "Force out the opponent's small spell and splash answers first.",
    "Layer threats that are awkward to answer with the same card.",
    "Vary placements and timing to make defensive reads harder.",
  ],
  beatdown: [
    "Build around a heavy core push and aim to convert one big attack.",
    "Accept some early damage while banking elixir for your power turn.",
    "Bait key defensive tools before committing your main push.",
  ],
  control: [
    "Gain small defensive advantages, then convert with counters.",
    "Focus on low-cost, high-value defensive sequencing and placements.",
    "Switch pressure lanes when the opponent's coverage is thin.",
  ],
  siege: [
    "Leverage range advantage and chip while holding a stable defense.",
    "Track opponent break-through cards and spell cycle before committing.",
    "Protect structure and board control over unnecessary overcommitment.",
  ],
  bridge_spam: [
    "Apply immediate bridge pressure to force rushed decisions.",
    "Split pressure across lanes instead of overcommitting to one side.",
    "Keep enough elixir for defense because counter-punish risk is high.",
  ],
};

function prettyKey(k: string): string {
  return k.replace(/^is_/, "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function Overview() {
  const nav = useNavigate();
  const { player, deckKey } = useSelection();
  const { master, loading: cardsLoading, error: cardsError } = useCardMaster();
  const { data: playersData } = useCommonPlayers();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<DeckSummaryResponse | null>(null);


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

  const playerLabel = useMemo(() => {
    if (!player) return "(not selected)";
    const deckName = selectedDeckBase?.deck_name?.trim() ? selectedDeckBase.deck_name : "No Name";
    return `${player.player_name} (${player.player_tag}) - ${deckName}`;
  }, [player, selectedDeckBase?.deck_name]);

  const mergedCards = useMemo<MergedCard[]>(() => {
    const baseCards = selectedDeckBase?.cards ?? [];
    const summaryCards = data?.cards ?? [];
    const byKey = new Map<string, MergedCard>();

    for (const c of baseCards) {
      byKey.set(`${c.card_id}:${c.slot_kind}`, { slot: c.slot, card_id: c.card_id, slot_kind: c.slot_kind, card_type: null, card_traits: [], classes: [] });
    }
    for (const c of summaryCards) {
      const k = `${c.card_id}:${c.slot_kind}`;
      const prev = byKey.get(k);
      byKey.set(k, { slot: prev?.slot ?? null, card_id: c.card_id, slot_kind: c.slot_kind, card_type: c.card_type, card_traits: c.card_traits, classes: c.classes });
    }

    return [...byKey.values()].sort((a, b) => {
      const aSlot = a.slot ?? Number.MAX_SAFE_INTEGER;
      const bSlot = b.slot ?? Number.MAX_SAFE_INTEGER;
      if (aSlot !== bSlot) return aSlot - bSlot;
      return a.card_id - b.card_id;
    });
  }, [selectedDeckBase, data]);

  const baseCardsWithCost = useMemo(() => {
    const baseCards = (selectedDeckBase?.cards ?? []).filter((c) => c.slot >= 0 && c.slot <= 7);
    return baseCards
      .map((c) => ({ ...c, cost: master?.getElixirCost(c.card_id) ?? null }))
      .filter((c): c is typeof c & { cost: number } => c.cost != null);
  }, [selectedDeckBase, master]);

  const minimumElixirCycle = useMemo(() => {
    const costs = baseCardsWithCost.map((c) => c.cost).sort((a, b) => a - b);
    if (costs.length < 4) return null;
    return costs.slice(0, 4).reduce((sum, c) => sum + c, 0);
  }, [baseCardsWithCost]);

  const averageElixirCost = useMemo(() => {
    if (baseCardsWithCost.length === 0) return null;
    return baseCardsWithCost.reduce((sum, c) => sum + c.cost, 0) / baseCardsWithCost.length;
  }, [baseCardsWithCost]);

  const deckTypeAnalysis = useMemo(() => {
    if (!data) return null;
    const traitCount = (keyIncludes: string) => data.deck_traits.filter((t) => t.trait_key.includes(keyIncludes)).reduce((sum, t) => sum + t.count, 0);
    const classCount = (keyIncludes: string) => data.deck_classes.filter((c) => c.class_key.includes(keyIncludes)).reduce((sum, c) => sum + c.count, 0);

    const winConditionCards = mergedCards.filter((c) => c.slot != null && c.slot >= 0 && c.slot <= 7 && c.classes.some((k) => k.includes("win_condition")));
    const winConditionCosts = winConditionCards
      .map((c) => master?.getElixirCost(c.card_id) ?? null)
      .filter((x): x is number => x != null);
    const winConditionAvgCost = winConditionCosts.length > 0 ? winConditionCosts.reduce((a, b) => a + b, 0) / winConditionCosts.length : null;

    const lowCostCount = baseCardsWithCost.filter((c) => c.cost <= 2).length;
    const swarmLikeCount = traitCount("swarm");
    const deployAnywhereCount = traitCount("deploy_anywhere");
    const outrangeTowerCount = traitCount("outrange_tower");
    const spawnsUnitsCount = traitCount("spawns_units");
    const buildingCount = data.cards.filter((card) => card.card_type === "building").length;
    const winConBuildingCount = data.cards.filter((card) => card.card_type === "building" && card.classes.some((k) => k.includes("win_condition"))).length;
    const canDamageAirCount = traitCount("can_damage_air");
    const isAirCount = traitCount("is_air");
    const antiAirClassCount = classCount("anti_air");

    const scores: Record<DeckTypeKey, number> = {
      cycle: 0,
      bait: 0,
      beatdown: 0,
      control: 1,
      siege: 0,
      bridge_spam: 0,
    };
    const reasons: Record<DeckTypeKey, string[]> = {
      cycle: [],
      bait: [],
      beatdown: [],
      control: [],
      siege: [],
      bridge_spam: [],
    };

    if (averageElixirCost != null && averageElixirCost < 3) {
      scores.cycle += 2;
      reasons.cycle.push("Average elixir is below 3.0.");
    } else if (averageElixirCost != null && averageElixirCost < 3.3) {
      scores.cycle += 1;
      reasons.cycle.push("Average elixir is relatively low.");
    }
    if (minimumElixirCycle != null && minimumElixirCycle <= 9) {
      scores.cycle += 1;
      reasons.cycle.push("Minimum cycle is fast.");
    }
    if (lowCostCount >= 3) {
      scores.cycle += 1;
      reasons.cycle.push("The deck has many low-cost cards.");
    }
    if (winConditionAvgCost != null && winConditionAvgCost <= 4) {
      scores.cycle += 1;
      reasons.cycle.push("Win-condition cost is relatively low.");
    }

    if (swarmLikeCount >= 2) {
      scores.bait += 2;
      reasons.bait.push("The deck includes many swarm-like traits.");
    } else if (swarmLikeCount === 1) {
      scores.bait += 1;
      reasons.bait.push("The deck includes swarm-like traits.");
    }
    if (deployAnywhereCount >= 1) {
      scores.bait += 1;
      reasons.bait.push("deploy_anywhere helps bait out responses.");
    }
    if (outrangeTowerCount >= 1) {
      scores.bait += 1;
      reasons.bait.push("outrange_tower improves sustained chip pressure.");
    }
    if (spawnsUnitsCount >= 1) {
      scores.bait += 1;
      reasons.bait.push("spawns_units makes defensive responses more awkward.");
    }

    if (averageElixirCost != null && averageElixirCost >= 4) {
      scores.beatdown += 2;
      reasons.beatdown.push("Average elixir is heavy.");
    } else if (averageElixirCost != null && averageElixirCost >= 3.8) {
      scores.beatdown += 1;
      reasons.beatdown.push("Average elixir is moderately heavy.");
    }
    if (minimumElixirCycle != null && minimumElixirCycle >= 13) {
      scores.beatdown += 1;
      reasons.beatdown.push("Minimum cycle is slow.");
    }
    if (winConditionAvgCost != null && winConditionAvgCost >= 5) {
      scores.beatdown += 2;
      reasons.beatdown.push("Win-condition cost is high.");
    } else if (winConditionAvgCost != null && winConditionAvgCost >= 4.5) {
      scores.beatdown += 1;
      reasons.beatdown.push("Win-condition cost is somewhat heavy.");
    }

    if (outrangeTowerCount >= 1) {
      scores.siege += 3;
      reasons.siege.push("The deck has outrange_tower traits.");
    }
    if (winConBuildingCount >= 1) {
      scores.siege += 2;
      reasons.siege.push("Includes a building-based win condition.");
    }
    if (buildingCount >= 2) {
      scores.siege += 1;
      reasons.siege.push("Includes multiple buildings.");
    }

    if (buildingCount === 0) {
      scores.bridge_spam += 1;
      reasons.bridge_spam.push("No building cards, so the deck is pressure-oriented.");
    }
    if (isAirCount + canDamageAirCount + antiAirClassCount <= 1) {
      scores.bridge_spam += 1;
      reasons.bridge_spam.push("Air coverage is relatively low.");
    }
    if (averageElixirCost != null && averageElixirCost >= 3.3 && averageElixirCost <= 4.2) {
      scores.bridge_spam += 1;
      reasons.bridge_spam.push("Elixir band supports bridge pressure patterns.");
    }

    if (averageElixirCost != null && averageElixirCost >= 3 && averageElixirCost <= 4) {
      scores.control += 1;
      reasons.control.push("Average elixir is in the mid range.");
    }
    if (buildingCount === 1) {
      scores.control += 1;
      reasons.control.push("One defensive building supports control pacing.");
    }
    if (minimumElixirCycle != null && minimumElixirCycle >= 10 && minimumElixirCycle <= 12) {
      scores.control += 1;
      reasons.control.push("Cycle speed is balanced for defend-and-counter play.");
    }

    const sorted = Object.entries(scores)
      .sort((a, b) => b[1] - a[1]) as Array<[DeckTypeKey, number]>;
    const [topType, topScore] = sorted[0];
    const [secondType, secondScore] = sorted[1];
    const mixed = topScore < 3 || topScore - secondScore < 1;

    const primaryType = mixed ? null : topType;
    const styleLabel = mixed ? `Mixed (${DECK_TYPE_LABEL[topType]} / ${DECK_TYPE_LABEL[secondType]})` : DECK_TYPE_LABEL[topType];
    const topReasons = reasons[topType].slice(0, 3);

    const normalizedScores = sorted
      .map(([k, v]) => `${DECK_TYPE_LABEL[k]} ${(v / 6).toFixed(2)}`)
      .join(" / ");

    return {
      styleLabel,
      normalizedScores,
      topReasons,
      tacticalGuide: primaryType ? TACTICAL_GUIDE[primaryType] : [
        `Top candidates: ${DECK_TYPE_LABEL[topType]} / ${DECK_TYPE_LABEL[secondType]}.`,
        "Prioritize stable defense early, then choose a win path after identifying key counters.",
        "Do not lock into one lane; convert any elixir lead into pressure.",
      ],
    };
  }, [averageElixirCost, baseCardsWithCost, data, master, mergedCards, minimumElixirCycle]);

  const deckIdentityLines = useMemo(() => {
    if (!data) return [];
    const traitCount = (keyIncludes: string) => data.deck_traits.filter((t) => t.trait_key.includes(keyIncludes)).reduce((sum, t) => sum + t.count, 0);
    const classCount = (keyIncludes: string) => data.deck_classes.filter((c) => c.class_key.includes(keyIncludes)).reduce((sum, c) => sum + c.count, 0);

    const antiAirClassCount = classCount("anti_air");
    const canDamageAirCount = traitCount("can_damage_air");
    const aoeCount = traitCount("aoe");

    const speed = minimumElixirCycle == null ? "Unknown" : minimumElixirCycle <= 9 ? "Fast" : minimumElixirCycle <= 12 ? "Mid" : "Slow";
    const airScore = canDamageAirCount + antiAirClassCount * 0.5;
    const airRes = airScore >= 3.5 ? "High" : airScore >= 2 ? "Medium" : "Low";
    const swarmRes = aoeCount >= 3 ? "High" : aoeCount >= 2 ? "Medium" : "Low";
    const buildingCardCount = data.cards.filter((card) => card.card_type === "building").length;
    const giantScore = buildingCardCount + traitCount("inferno") * 0.5 + classCount("anti_tank") * 0.5;
    const giantRes = giantScore >= 2.5 ? "High" : giantScore >= 1.5 ? "Medium" : "Low";
    const deployAnywhereCount = traitCount("deploy_anywhere");
    const outrangeTowerCount = traitCount("outrange_tower");
    const primaryTargetBuildingsCount = traitCount("primary_target_buildings");
    const buildingScore = deployAnywhereCount * 0.5 + outrangeTowerCount * 0.5 + (primaryTargetBuildingsCount >= 2 ? 0.5 : 0);
    const buildingRes = buildingScore >= 1.5 ? "High" : buildingScore >= 0.5 ? "Medium" : "Low";
    const avgCost = averageElixirCost != null ? averageElixirCost.toFixed(2) : "-";

    return [
      `Deck style: ${deckTypeAnalysis?.styleLabel ?? "Unknown"}`,
      `Type score: ${deckTypeAnalysis?.normalizedScores ?? "-"}`,
      `Average elixir: ${avgCost}`,
      `Air resistance: ${airRes}`,
      `Swarm resistance: ${swarmRes}`,
      `Giant resistance: ${giantRes}`,
      `Building resistance: ${buildingRes}`,
      `Cycle speed: ${speed}`,
    ];
  }, [averageElixirCost, data, deckTypeAnalysis, minimumElixirCycle]);

  const tacticalNotes = useMemo(() => {
    if (!deckTypeAnalysis) return [];
    return [...deckTypeAnalysis.topReasons, ...deckTypeAnalysis.tacticalGuide].slice(0, 6);
  }, [deckTypeAnalysis]);

  const strengths = useMemo(() => {
    if (!data) return [];
    const xs: string[] = [];
    const countTrait = (keyIncludes: string) => data.deck_traits.filter((t) => t.trait_key.includes(keyIncludes)).reduce((sum, t) => sum + t.count, 0);
    const countClass = (keyIncludes: string) => data.deck_classes.filter((c) => c.class_key.includes(keyIncludes)).reduce((sum, c) => sum + c.count, 0);
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
    const countTrait = (keyIncludes: string) => data.deck_traits.filter((t) => t.trait_key.includes(keyIncludes)).reduce((sum, t) => sum + t.count, 0);
    const countClass = (keyIncludes: string) => data.deck_classes.filter((c) => c.class_key.includes(keyIncludes)).reduce((sum, c) => sum + c.count, 0);
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
              <button onClick={() => nav("/settings")} className="inline-flex items-center rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700">
                Open Settings →
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {cardsError ? <ApiErrorPanel title="Cards error" detail={cardsError} /> : null}
      {err ? <ApiErrorPanel title="Summary error" detail={err} /> : null}

      {!err ? (
        <DeckProfileSection loading={loading || cardsLoading} deckIdentityLines={deckIdentityLines} tacticalNotes={tacticalNotes} strengths={strengths} weaknesses={weaknesses} />
      ) : null}

      {!loading && !err && data ? (
        <DeckDataSection
          minimumElixirCycle={minimumElixirCycle}
          cards={mergedCards}
          getName={(id) => master?.getName(id) ?? `#${id}`}
          getIconUrl={(id, kind) => master?.getIconUrl(id, kind) ?? null}
          getElixirCost={(id) => master?.getElixirCost(id) ?? null}
          prettyKey={prettyKey}
          deckTraits={data.deck_traits}
          deckClasses={data.deck_classes}
        />
      ) : null}
    </section>
  );
}
