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

type IssueSide = "attack" | "defense";
type WhyTab = "attack" | "defense";

type Issue = {
  side: IssueSide;
  label: string;
  encounterRate: number;
  deltaVsBaseline: number;
  battles: number;
  expectedLoss: number;
};

type ActionPlan = {
  id: string;
  title: string;
  reason: string;
  currentState: string;
  priority: number;
};

function prettyKey(k: string): string {
  return k.replace(/^is_/, "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function pct(v: number): string {
  return `${Math.round(v * 1000) / 10}%`;
}

function expectedLoss(battles: number, baseline: number, given: number): number {
  return battles * Math.max(0, baseline - given);
}

function traitCount(summary: DeckSummaryResponse | null, keyIncludes: string): number {
  if (!summary) return 0;
  return summary.deck_traits
    .filter((t) => t.trait_key.includes(keyIncludes))
    .reduce((sum, t) => sum + t.count, 0);
}

function categoryForThreat(cardName: string): string {
  const x = cardName.toLowerCase();
  if (x.includes("giant") || x.includes("hog") || x.includes("ram") || x.includes("golem") || x.includes("balloon")) {
    return "建物への圧に強い受け";
  }
  return "受け先と回し方";
}

function ScatterPlot({
  points,
}: {
  points: Array<{ key: string; label: string; x: number; y: number; size: number }>;
}) {
  if (!points.length) return <div className="text-xs text-slate-500">十分なデータがありません。</div>;

  const w = 300;
  const h = 170;
  const maxX = Math.max(...points.map((p) => p.x), 0.001);
  const maxY = Math.max(...points.map((p) => p.y), 0.001);
  const maxS = Math.max(...points.map((p) => p.size), 1);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 w-full rounded-xl border border-slate-200 bg-white">
      <line x1={30} y1={h - 24} x2={w - 8} y2={h - 24} stroke="#cbd5e1" strokeWidth="1" />
      <line x1={30} y1={8} x2={30} y2={h - 24} stroke="#cbd5e1" strokeWidth="1" />
      {points.map((p) => {
        const cx = 30 + (p.x / maxX) * (w - 46);
        const cy = h - 24 - (p.y / maxY) * (h - 36);
        const r = 4 + (p.size / maxS) * 6;
        return <circle key={p.key} cx={cx} cy={cy} r={r} fill="#2563eb" fillOpacity="0.65" />;
      })}
    </svg>
  );
}

function ThreatBars({
  items,
}: {
  items: Array<{ key: string; label: string; expectedLoss: number; encounterRate: number }>;
}) {
  if (!items.length) return <div className="text-xs text-slate-500">十分なデータがありません。</div>;
  const maxV = Math.max(...items.map((x) => x.expectedLoss), 0.001);

  return (
    <div className="mt-2 space-y-2">
      {items.map((x) => (
        <div key={x.key}>
          <div className="flex items-center justify-between text-xs text-slate-700">
            <span>{x.label}</span>
            <span>EL {x.expectedLoss.toFixed(1)} / 遭遇 {pct(x.encounterRate)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-rose-500" style={{ width: `${(x.expectedLoss / maxV) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ImprovePage() {
  const { player, deckKey } = useSelection();
  const { master } = useCardMaster();
  const seasons = 2;

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
          getDeckOffenseCounters(deckKey, seasons),
          getDeckDefenseThreats(deckKey, seasons),
          getTrendTraits(player.player_tag, seasons),
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
    if (!offense) return null;
    const baseline = offense.summary.baseline_win_rate;
    const candidate = offense.counters.traits
      .filter((t) => t.stats.encounter_rate <= 0.85)
      .map((t) => ({
        trait: t,
        loss: expectedLoss(t.stats.battles_with_element, baseline, t.stats.win_rate_given),
      }))
      .sort((a, b) => b.loss - a.loss)[0];

    if (!candidate) return null;
    return {
      side: "attack",
      label: prettyKey(candidate.trait.trait_key),
      encounterRate: candidate.trait.stats.encounter_rate,
      deltaVsBaseline: candidate.trait.stats.delta_vs_baseline,
      battles: candidate.trait.stats.battles_with_element,
      expectedLoss: candidate.loss,
    };
  }, [offense]);

  const defenseIssue = useMemo<Issue | null>(() => {
    if (!defense) return null;
    const baseline = defense.summary.baseline_win_rate;
    const candidate = defense.threats
      .map((t) => ({
        threat: t,
        loss: expectedLoss(t.stats.battles_with_element, baseline, t.stats.win_rate_given),
      }))
      .sort((a, b) => b.loss - a.loss)[0];

    if (!candidate) return null;
    return {
      side: "defense",
      label: master?.getName(candidate.threat.card_id) ?? `#${candidate.threat.card_id}`,
      encounterRate: candidate.threat.stats.encounter_rate,
      deltaVsBaseline: candidate.threat.stats.delta_vs_baseline,
      battles: candidate.threat.stats.battles_with_element,
      expectedLoss: candidate.loss,
    };
  }, [defense, master]);

  const priorityIssue = useMemo(() => {
    if (!attackIssue) return defenseIssue;
    if (!defenseIssue) return attackIssue;
    return attackIssue.expectedLoss >= defenseIssue.expectedLoss ? attackIssue : defenseIssue;
  }, [attackIssue, defenseIssue]);

  const attackScatterPoints = useMemo(() => {
    if (!offense || !trend) return [];
    const baseline = offense.summary.baseline_win_rate;
    return offense.counters.traits
      .filter((t) => t.stats.encounter_rate <= 0.85)
      .map((t) => {
        const tr = trend.traits.find((x) => x.trait_key === t.trait_key);
        const impact = Math.max(0, baseline - t.stats.win_rate_given);
        return {
          key: t.trait_key,
          label: prettyKey(t.trait_key),
          x: tr?.summary.mean_count ?? 0,
          y: impact,
          size: t.stats.battles_with_element,
        };
      })
      .filter((x) => x.x > 0 || x.y > 0)
      .sort((a, b) => b.x * b.y - a.x * a.y)
      .slice(0, 10);
  }, [offense, trend]);

  const defenseBars = useMemo(() => {
    if (!defense) return [];
    const baseline = defense.summary.baseline_win_rate;
    return defense.threats
      .map((t) => ({
        key: `${t.card_id}`,
        label: master?.getName(t.card_id) ?? `#${t.card_id}`,
        expectedLoss: expectedLoss(t.stats.battles_with_element, baseline, t.stats.win_rate_given),
        encounterRate: t.stats.encounter_rate,
      }))
      .sort((a, b) => b.expectedLoss - a.expectedLoss)
      .slice(0, 5);
  }, [defense, master]);

  const actions = useMemo<ActionPlan[]>(() => {
    if (!summary) return [];
    const xs: ActionPlan[] = [];
    const topAttack = attackIssue?.label.toLowerCase() ?? "";
    const topDefense = defenseIssue?.label ?? "";

    const stunCount = traitCount(summary, "stun") + traitCount(summary, "immobilize");
    if ((topAttack.includes("stun") || topAttack.includes("immobilize")) && stunCount <= 1) {
      xs.push({
        id: "act-stun",
        title: "行動キャンセル耐性を厚くする",
        reason: `攻め阻害の上位が ${attackIssue?.label ?? "stun系"}`,
        currentState: `あなたの現状: stun/immobilize系 trait count = ${stunCount}`,
        priority: attackIssue?.expectedLoss ?? 0,
      });
    }

    const aoeCount = traitCount(summary, "splash") + traitCount(summary, "area");
    if ((topAttack.includes("swarm") || topAttack.includes("bait")) && aoeCount <= 1) {
      xs.push({
        id: "act-aoe",
        title: "範囲処理カテゴリを厚くする",
        reason: `攻め阻害の傾向に ${attackIssue?.label ?? "swarm/bait"} が見える`,
        currentState: `あなたの現状: AoE系 trait count = ${aoeCount}`,
        priority: (attackIssue?.expectedLoss ?? 0) * 0.95,
      });
    }

    const buildingCount = summary.cards.filter((c) => c.card_type === "building").length;
    if (defenseIssue && buildingCount === 0) {
      xs.push({
        id: "act-defense-accept",
        title: `${categoryForThreat(topDefense)}を1枠検討する`,
        reason: `守り脅威の上位が ${topDefense}`,
        currentState: `あなたの現状: building card count = ${buildingCount}`,
        priority: defenseIssue.expectedLoss,
      });
    }

    if (xs.length === 0) {
      xs.push({
        id: "act-review",
        title: "崩れ方のカテゴリを1つ固定して試す",
        reason: "上位Issueに直結する不足カテゴリが明確でないため",
        currentState: "あなたの現状: まず3〜5戦の観察で原因候補を固定",
        priority: 0,
      });
    }

    return xs.sort((a, b) => b.priority - a.priority).slice(0, 3);
  }, [summary, attackIssue, defenseIssue]);

  const selectedAction = useMemo(() => actions.find((x) => x.id === selectedActionId) ?? null, [actions, selectedActionId]);

  const trendTopWinCons = useMemo(() => {
    if (!winConTrend) return [];
    const total = winConTrend.total_points || 1;
    return winConTrend.cards.slice(0, 3).map((c) => ({
      name: master?.getName(c.card_id) ?? `#${c.card_id}`,
      rate: c.fractional_points / total,
    }));
  }, [winConTrend, master]);

  return (
    <section className="mx-auto max-w-md space-y-4 px-4 pt-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">Improve</h1>
        <div className="mt-1 text-xs text-slate-500">Issue / Why / Action の3段で、次に試す1手を決めます。</div>
      </div>

      {err ? <ApiErrorPanel detail={err} /> : null}
      {loading ? <SectionCard><div className="text-sm text-slate-500">Loading improve insights...</div></SectionCard> : null}

      {!loading && !err ? (
        <>
          <SectionCard>
            <div className="text-sm font-semibold text-slate-900">Issue（今の最優先課題）</div>
            <div className="mt-2 text-sm text-slate-700">Attack Issue: {attackIssue ? `攻めが止められやすい：${attackIssue.label}` : "データ不足"}</div>
            <div className="mt-1 text-sm text-slate-700">Defense Issue: {defenseIssue ? `守りが崩れやすい：${defenseIssue.label}` : "データ不足"}</div>
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
              結論: 今は {priorityIssue?.side === "defense" ? "Defense" : "Attack"} を先に直す
            </div>
            {priorityIssue ? (
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-600">
                <div>遭遇率 {pct(priorityIssue.encounterRate)}</div>
                <div>勝率差 {pct(priorityIssue.deltaVsBaseline)}</div>
                <div>battles {priorityIssue.battles}</div>
              </div>
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
                  環境×攻め阻害
                </button>
                <button
                  onClick={() => setWhyTab("defense")}
                  className={`rounded-lg px-2 py-1 ${whyTab === "defense" ? "bg-white text-slate-900" : "text-slate-600"}`}
                >
                  守り脅威
                </button>
              </div>
            </div>

            {whyTab === "attack" ? (
              <>
                <div className="mt-2 text-xs text-slate-600">散布図: X=環境強さ(mean_count), Y=悪影響(baseline-win_rate_given), サイズ=battles</div>
                <ScatterPlot points={attackScatterPoints} />
              </>
            ) : (
              <>
                <div className="mt-2 text-xs text-slate-600">棒グラフ: Top threats（expected_loss）</div>
                <ThreatBars items={defenseBars} />
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
