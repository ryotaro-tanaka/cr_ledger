import { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/SectionCard";
import ApiErrorPanel from "../components/ApiErrorPanel";
import { useSelection } from "../lib/selection";
import { useCardMaster } from "../cards/useCardMaster";
import { toErrorText } from "../lib/errors";
import {
  getDeckDefenseThreats,
  getDeckOffenseCounters,
  getDeckSummary,
  getTrendTraits,
  getTrendWinConditions,
} from "../api/api";
import type {
  DeckDefenseThreatsResponse,
  DeckOffenseCountersResponse,
  DeckSummaryResponse,
  TrendTraitsResponse,
  TrendWinConditionsResponse,
} from "../api/types";

type WhyTab = "attack" | "defense";
type IssueSide = "attack" | "defense";

type Issue = {
  side: IssueSide;
  label: string;
  encounterRate: number;
  deltaVsBaseline: number;
  battles: number;
  expectedLoss: number;
  exampleCards: string[];
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

function cardExamplesForTrait(traitKey: string, offense: DeckOffenseCountersResponse | null, master: ReturnType<typeof useCardMaster>["master"]): string[] {
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
    .map((c) => master?.getName(c.card_id) ?? `#${c.card_id}`);

  return matched;
}

function OffenseCompareBars({ items }: { items: OffenseBarItem[] }) {
  if (!items.length) return <div className="text-xs text-slate-500">十分なデータがありません。</div>;
  const maxEnv = Math.max(...items.map((i) => i.envAvgCount), 0.001);
  const maxMy = Math.max(...items.map((i) => i.myDeckCount), 0.001);

  return (
    <div className="mt-2 space-y-3">
      {items.map((i) => (
        <div key={i.key} className="rounded-xl border border-slate-200 bg-white p-2">
          <div className="text-xs font-semibold text-slate-900">{i.label}</div>
          <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
            <div>
              <div>環境平均 {i.envAvgCount.toFixed(2)}枚</div>
              <div className="mt-1 h-1.5 rounded bg-slate-100">
                <div className="h-full rounded bg-indigo-500" style={{ width: `${(i.envAvgCount / maxEnv) * 100}%` }} />
              </div>
            </div>
            <div>
              <div>あなた {i.myDeckCount}枚</div>
              <div className="mt-1 h-1.5 rounded bg-slate-100">
                <div className="h-full rounded bg-emerald-500" style={{ width: `${(i.myDeckCount / Math.max(maxMy, 1)) * 100}%` }} />
              </div>
            </div>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">勝率差 {signedPct(i.deltaVsBaseline)} / EL {i.expectedLoss.toFixed(1)}</div>
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
  if (!items.length) return <div className="text-xs text-slate-500">十分なデータがありません。</div>;
  const maxLoss = Math.max(...items.map((x) => x.expectedLoss), 0.001);

  return (
    <div className="mt-2 space-y-2">
      {items.map((x) => (
        <div key={x.key}>
          <div className="flex items-center justify-between text-xs text-slate-700">
            <span>{x.label}</span>
            <span>EL {x.expectedLoss.toFixed(1)} / 勝率差 {signedPct(x.deltaVsBaseline)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-rose-500" style={{ width: `${(x.expectedLoss / maxLoss) * 100}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-slate-500">遭遇率 {pct(x.encounterRate)}</div>
        </div>
      ))}
    </div>
  );
}

export default function ImprovePage() {
  const { player, deckKey } = useSelection();
  const { master } = useCardMaster();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [offense, setOffense] = useState<DeckOffenseCountersResponse | null>(null);
  const [defense, setDefense] = useState<DeckDefenseThreatsResponse | null>(null);
  const [trend, setTrend] = useState<TrendTraitsResponse | null>(null);
  const [summary, setSummary] = useState<DeckSummaryResponse | null>(null);
  const [winConTrend, setWinConTrend] = useState<TrendWinConditionsResponse | null>(null);
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
        const [off, def, tr, sum, wc] = await Promise.all([
          getDeckOffenseCounters(deckKey, 2),
          getDeckDefenseThreats(deckKey, 2),
          getTrendTraits(player.player_tag, 2),
          getDeckSummary(deckKey),
          getTrendWinConditions(player.player_tag, 200),
        ]);
        if (cancelled) return;
        setOffense(off);
        setDefense(def);
        setTrend(tr);
        setSummary(sum);
        setWinConTrend(wc);
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
      exampleCards: cardExamplesForTrait(hit.trait.trait_key, offense, master),
    };
  }, [offense, trend, master]);

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
      exampleCards: [master?.getName(hit.threat.card_id) ?? `#${hit.threat.card_id}`],
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
        };
      })
      .filter((x) => x.expectedLoss > 0)
      .sort((a, b) => b.expectedLoss - a.expectedLoss)
      .slice(0, 4);
  }, [offense, trend, summary]);

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
        title: "行動キャンセル耐性を増やす構成を検討",
        reason: `攻撃Issueが ${attackIssue?.label ?? "stun系"}（勝率差 ${signedPct(attackIssue?.deltaVsBaseline ?? 0)}）`,
        currentState: `現状: stun/immobilize trait count = ${stunCount}`,
        checks: ["次の5戦で攻め失敗の回数", "スタン系対面での勝率"],
        priority: attackIssue?.expectedLoss ?? 0,
      });
    }

    const aoeCount = traitCount(summary, "aoe") + traitCount(summary, "splash") + traitCount(summary, "area");
    if ((attackLabel.includes("swarm") || attackLabel.includes("bait")) && aoeCount <= 1) {
      xs.push({
        id: "action-aoe",
        title: "範囲処理カテゴリを1枠厚くする構成を検討",
        reason: `攻撃Issueが ${attackIssue?.label ?? "swarm/bait"} で阻害されている`,
        currentState: `現状: AoE系 trait count = ${aoeCount}`,
        checks: ["次の5戦で群れ処理の失敗回数", "呪文温存の成功率"],
        priority: (attackIssue?.expectedLoss ?? 0) * 0.95,
      });
    }

    const buildingCount = summary.cards.filter((c) => c.card_type === "building").length;
    if (defenseIssue && buildingCount === 0) {
      xs.push({
        id: "action-defense",
        title: "受け専用枠（建物/高DPS）を1枠増やす構成を検討",
        reason: `Defense Issueが ${defenseLabel}（勝率差 ${signedPct(defenseIssue.deltaVsBaseline)}）`,
        currentState: `現状: 建物カード数 = ${buildingCount}`,
        checks: ["次の5戦で${defenseLabel}対面の勝率", "受け札温存の成功率"],
        priority: defenseIssue.expectedLoss,
      });
    }

    if (xs.length === 0) {
      xs.push({
        id: "action-fallback",
        title: "上位Issueに対する受け失敗パターンを1つ固定して検証",
        reason: "不足カテゴリが明確でないため、まず失敗パターンを固定して試す",
        currentState: "現状: 直近5戦から攻め失敗2件/守り失敗2件を抽出",
        checks: ["次の5戦で同失敗の再発率", "調整後の勝率差"],
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

  const issueLine = priorityIssue
    ? priorityIssue.side === "attack"
      ? `攻撃が「${priorityIssue.label}系」で止められやすい（勝率 ${signedPct(priorityIssue.deltaVsBaseline)}）`
      : `守りが「${priorityIssue.label}」に崩れやすい（勝率 ${signedPct(priorityIssue.deltaVsBaseline)}）`
    : "優先課題を決めるデータが不足しています";

  return (
    <section className="mx-auto max-w-md space-y-4 px-4 pt-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">Improve</h1>
        <div className="mt-1 text-xs text-slate-500">Issue / Why / Action の3段で、次の5戦で試す方針を決めます。</div>
      </div>

      {err ? <ApiErrorPanel detail={err} /> : null}
      {loading ? <SectionCard><div className="text-sm text-slate-500">Loading improve insights...</div></SectionCard> : null}

      {!loading && !err ? (
        <>
          <SectionCard>
            <div className="text-sm font-semibold text-slate-900">Issue（今の最優先課題）</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{issueLine}</div>
            <div className="mt-1 text-xs text-slate-600">Attack Issue: {attackIssue ? `${attackIssue.label} / EL ${attackIssue.expectedLoss.toFixed(1)}` : "データ不足"}</div>
            <div className="mt-1 text-xs text-slate-600">Defense Issue: {defenseIssue ? `${defenseIssue.label} / EL ${defenseIssue.expectedLoss.toFixed(1)}` : "データ不足"}</div>
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              結論: 今は {priorityIssue?.side === "defense" ? "Defense" : "Attack"} を先に直す
              {priorityIssue ? `（遭遇率 ${pct(priorityIssue.encounterRate)} / battles ${priorityIssue.battles}）` : ""}
            </div>
            {priorityIssue?.exampleCards.length ? (
              <div className="mt-2 text-xs text-slate-600">具体カード例: {priorityIssue.exampleCards.join(" / ")}</div>
            ) : null}
          </SectionCard>

          <SectionCard>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Why（根拠）</div>
              <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-xs">
                <button
                  onClick={() => setWhyTab("attack")}
                  className={`rounded-lg px-2 py-1 ${whyTab === "attack" ? "bg-white text-slate-900" : "text-slate-600"}`}
                >
                  環境平均 vs 自分（攻め）
                </button>
                <button
                  onClick={() => setWhyTab("defense")}
                  className={`rounded-lg px-2 py-1 ${whyTab === "defense" ? "bg-white text-slate-900" : "text-slate-600"}`}
                >
                  守り脅威（cards）
                </button>
              </div>
            </div>

            {whyTab === "attack" ? (
              <>
                <div className="mt-2 text-xs text-slate-600">上位traitsの「環境平均枚数」と「あなたの枚数」を比較（EL/勝率差付き）</div>
                <OffenseCompareBars items={offenseCompare} />
              </>
            ) : (
              <>
                <div className="mt-2 text-xs text-slate-600">Top threatsを expected loss 主軸で表示（勝率差・遭遇率付き）</div>
                <DefenseBars items={defenseBars} />
              </>
            )}

            {trendTopWinCons.length ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                環境の勝ち筋 Top3: {trendTopWinCons.map((x) => `${x.name} ${pct(x.rate)}`).join(" / ")}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard>
            <div className="text-sm font-semibold text-slate-900">Action（試す方針）</div>
            {selectedAction ? (
              <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                固定メモ: {selectedAction.title}
              </div>
            ) : null}
            <div className="mt-3 space-y-3">
              {actions.map((a) => (
                <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-sm font-semibold text-slate-900">{a.title}</div>
                  <div className="mt-1 text-xs text-slate-600">なぜ今か: {a.reason}</div>
                  <div className="mt-1 text-xs text-slate-500">{a.currentState}</div>
                  <div className="mt-1 text-[11px] text-slate-500">次の5戦で検証: {a.checks.join(" / ")}</div>
                  <button
                    onClick={() => setSelectedActionId(a.id)}
                    className={`mt-2 rounded-xl px-3 py-1.5 text-xs font-medium ${selectedActionId === a.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                  >
                    この方針で検討
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-slate-500">※ 統計的関連に基づく提案であり、因果は断定しません。</div>
          </SectionCard>
        </>
      ) : null}
    </section>
  );
}
