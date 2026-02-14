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
    const traitCount = (keyIncludes: string) => data.deck_traits.filter((t) => t.trait_key.includes(keyIncludes)).reduce((sum, t) => sum + t.count, 0);
    const classCount = (keyIncludes: string) => data.deck_classes.filter((c) => c.class_key.includes(keyIncludes)).reduce((sum, c) => sum + c.count, 0);

    const winConCount = classCount("win_condition");
    const antiAirClassCount = classCount("anti_air");
    const canDamageAirCount = traitCount("can_damage_air");
    const aoeCount = traitCount("aoe");
    const buildingCount = classCount("building");
    const swarmLikeCount = traitCount("swarm");

    const style = minimumElixirCycle != null && minimumElixirCycle <= 9
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

    return [
      `Deck style: ${style}`,
      `Air resistance: ${airRes}`,
      `Swarm resistance: ${swarmRes}`,
      `Giant resistance: ${giantRes}`,
      `Building resistance: ${buildingRes}`,
      `Cycle speed: ${speed}`,
    ];
  }, [data, minimumElixirCycle]);

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
        <DeckProfileSection loading={loading || cardsLoading} deckIdentityLines={deckIdentityLines} strengths={strengths} weaknesses={weaknesses} />
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
