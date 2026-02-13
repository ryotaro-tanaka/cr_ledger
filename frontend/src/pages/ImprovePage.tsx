import { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/SectionCard";
import ApiErrorPanel from "../components/ApiErrorPanel";
import { useSelection } from "../lib/selection";
import { useCardMaster } from "../cards/useCardMaster";
import { toErrorText } from "../lib/errors";
import {
  getDeckDefenseThreats,
  getDeckOffenseCounters,
  getTrendTraits,
} from "../api/api";
import type {
  DeckDefenseThreatsResponse,
  DeckOffenseCountersResponse,
  TrendTraitsResponse,
} from "../api/types";

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

function riskTone(score: number): "高" | "中" | "低" {
  if (score >= 0.2) return "高";
  if (score >= 0.08) return "中";
  return "低";
}

function RiskBar({ value }: { value: number }) {
  const ratio = Math.max(0, Math.min(1, value));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.max(ratio * 100, ratio > 0 ? 4 : 0)}%` }} />
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
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!player || !deckKey) return;

    let cancelled = false;

    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [off, def, tr] = await Promise.all([
          getDeckOffenseCounters(deckKey, seasons),
          getDeckDefenseThreats(deckKey, seasons),
          getTrendTraits(player.player_tag, seasons),
        ]);
        if (cancelled) return;
        setOffense(off);
        setDefense(def);
        setTrend(tr);
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

  const topOffenseTrait = useMemo(() => offense?.counters.traits[0] ?? null, [offense]);
  const topDefenseCard = useMemo(() => defense?.threats[0] ?? null, [defense]);
  const topTrendTrait = useMemo(() => trend?.traits[0] ?? null, [trend]);

  const primaryIssue = useMemo(() => {
    const candidates: Array<{
      key: string;
      label: string;
      source: "offense" | "defense";
      encounter: number;
      delta: number;
      threat: number;
      details: string;
      actionHint: string;
    }> = [];

    if (topOffenseTrait) {
      candidates.push({
        key: `off-trait-${topOffenseTrait.trait_key}`,
        label: prettyKey(topOffenseTrait.trait_key),
        source: "offense",
        encounter: topOffenseTrait.stats.encounter_rate,
        delta: topOffenseTrait.stats.delta_vs_baseline,
        threat: topOffenseTrait.stats.threat_score,
        details: "攻めで止められやすい傾向",
        actionHint: "攻め筋の通りやすさを上げる候補を優先",
      });
    }
    if (topDefenseCard) {
      const name = master?.getName(topDefenseCard.card_id) ?? `#${topDefenseCard.card_id}`;
      candidates.push({
        key: `def-card-${topDefenseCard.card_id}`,
        label: name,
        source: "defense",
        encounter: topDefenseCard.stats.encounter_rate,
        delta: topDefenseCard.stats.delta_vs_baseline,
        threat: topDefenseCard.stats.threat_score,
        details: "守りで崩れやすい相手",
        actionHint: "受け先・回し方を明確化する候補を優先",
      });
    }

    candidates.sort((a, b) => b.threat - a.threat || b.encounter - a.encounter);
    return candidates[0] ?? null;
  }, [topOffenseTrait, topDefenseCard, master]);

  const plans = useMemo(() => {
    const xs: Array<{ id: string; title: string; reason: string; score: number; cue: string }> = [];

    if (topTrendTrait?.trait_key.includes("swarm") || topTrendTrait?.trait_key.includes("bait")) {
      xs.push({
        id: "plan-aoe",
        title: "AoEを1枚増やす",
        reason: `環境で ${prettyKey(topTrendTrait.trait_key)} が目立つため（2枚以上率 ${pct(topTrendTrait.summary.rate_ge_2)}）`,
        score: topTrendTrait.summary.rate_ge_2,
        cue: "呪文1枚の置き換え候補を先に比較",
      });
    }

    if (topDefenseCard) {
      xs.push({
        id: "plan-building",
        title: "建物を追加する",
        reason: `${master?.getName(topDefenseCard.card_id) ?? `#${topDefenseCard.card_id}`} への受けを明確化する`,
        score: topDefenseCard.stats.encounter_rate,
        cue: "高コスト枠との入れ替えを優先確認",
      });
    }

    if (topOffenseTrait?.trait_key.includes("stun") || topOffenseTrait?.trait_key.includes("immobilize")) {
      xs.push({
        id: "plan-cycle",
        title: "Stun対策比率を見直す",
        reason: `${prettyKey(topOffenseTrait.trait_key)} の遭遇率 ${pct(topOffenseTrait.stats.encounter_rate)} を見て再配分を検討候補にする`,
        score: topOffenseTrait.stats.encounter_rate,
        cue: "勝ち筋ユニットを減らしすぎない範囲で調整",
      });
    }

    if (xs.length === 0) {
      xs.push({
        id: "plan-replay",
        title: "直近リプレイから崩れ方を1つ特定する",
        reason: "攻め失敗1回・守り失敗1回だけ抽出して、差し替え候補を決める",
        score: 0,
        cue: "2試合だけ見て判断を固定しすぎない",
      });
    }

    return xs.sort((a, b) => b.score - a.score).slice(0, 3);
  }, [topTrendTrait, topDefenseCard, topOffenseTrait, master]);

  const selectedPlanData = useMemo(() => plans.find((p) => p.id === selectedPlan) ?? null, [plans, selectedPlan]);

  const nextCandidates = useMemo(() => {
    const xs: string[] = [];
    if (topDefenseCard) xs.push(`${master?.getName(topDefenseCard.card_id) ?? `#${topDefenseCard.card_id}`} 耐性`);
    if (topTrendTrait) xs.push(`${prettyKey(topTrendTrait.trait_key)} 相性`);
    return xs.slice(0, 2);
  }, [topDefenseCard, topTrendTrait, master]);

  return (
    <section className="mx-auto max-w-md space-y-4 px-4 pt-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">Improve</h1>
        <div className="mt-1 text-xs text-slate-500">今変えるべき1点を先に決めて、次点は後ろに回します。</div>
      </div>

      {err ? <ApiErrorPanel detail={err} /> : null}
      {loading ? <SectionCard><div className="text-sm text-slate-500">Loading improve insights...</div></SectionCard> : null}

      {!loading && !err ? (
        <>
          <SectionCard>
            <div className="text-sm font-semibold text-slate-900">🔥 Step 1：今一番の問題</div>
            {primaryIssue ? (
              <div className="mt-3 space-y-2">
                <div className="text-base font-semibold text-slate-900">最大リスク：{primaryIssue.label}</div>
                <div className="text-xs text-slate-600">{primaryIssue.details}</div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  先に見る理由：{primaryIssue.source === "offense" ? "攻め" : "守り"}側で脅威スコアが最大（{riskTone(primaryIssue.threat)}）。{primaryIssue.actionHint}
                </div>
                <RiskBar value={primaryIssue.encounter} />
                <div className="grid grid-cols-3 gap-2 text-xs text-slate-700">
                  <div>遭遇率: {pct(primaryIssue.encounter)}</div>
                  <div>勝率差: {signedPct(primaryIssue.delta)}</div>
                  <div>脅威スコア: {riskTone(primaryIssue.threat)}</div>
                </div>
                <details className="pt-1 text-xs text-slate-600">
                  <summary className="cursor-pointer">詳細を見る（補助情報）</summary>
                  <div className="mt-2 space-y-1">
                    {topOffenseTrait ? <div>攻め: {prettyKey(topOffenseTrait.trait_key)} / {pct(topOffenseTrait.stats.encounter_rate)} / {pct(topOffenseTrait.stats.delta_vs_baseline)}</div> : null}
                    {topDefenseCard ? <div>守り: {master?.getName(topDefenseCard.card_id) ?? `#${topDefenseCard.card_id}`} / {pct(topDefenseCard.stats.encounter_rate)} / {pct(topDefenseCard.stats.delta_vs_baseline)}</div> : null}
                    {topTrendTrait ? <div>環境: {prettyKey(topTrendTrait.trait_key)} / 2枚以上率 {pct(topTrendTrait.summary.rate_ge_2)}</div> : null}
                  </div>
                </details>
              </div>
            ) : (
              <div className="mt-2 text-sm text-slate-600">最大問題を特定できるデータが不足しています。</div>
            )}
          </SectionCard>

          <SectionCard>
            <div className="text-sm font-semibold text-slate-900">🟦 Step 2：改善候補（最大3）</div>
            {selectedPlanData ? (
              <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                選択中：{selectedPlanData.title}（まずは3〜5戦の試行候補）
              </div>
            ) : null}
            <div className="mt-3 space-y-3">
              {plans.map((p) => (
                <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-sm font-semibold text-slate-900">{p.title}</div>
                  <div className="mt-1 text-xs text-slate-600">→ {p.reason}</div>
                  <div className="mt-1 text-[11px] text-slate-500">判断の目安: {p.cue}</div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => setSelectedPlan(p.id)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-medium ${selectedPlan === p.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                    >
                      この方向で検討する
                    </button>
                    <button
                      onClick={() => setSelectedPlan(null)}
                      className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    >
                      今は保留
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard>
            <div className="text-sm font-semibold text-slate-900">次の候補</div>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
              {nextCandidates.length ? nextCandidates.map((n) => <li key={n}>{n}</li>) : <li>候補抽出待ち</li>}
            </ol>
            <div className="mt-2 text-[11px] text-slate-500">※ 統計的関連に基づく提案であり、因果を断定しません（検討候補）。</div>
          </SectionCard>
        </>
      ) : null}
    </section>
  );
}
