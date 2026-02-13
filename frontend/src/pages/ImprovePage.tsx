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

export default function ImprovePage() {
  const { player, deckKey } = useSelection();
  const { master } = useCardMaster();
  const seasons = 2;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [offense, setOffense] = useState<DeckOffenseCountersResponse | null>(null);
  const [defense, setDefense] = useState<DeckDefenseThreatsResponse | null>(null);
  const [trend, setTrend] = useState<TrendTraitsResponse | null>(null);

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
  const topOffenseCard = useMemo(() => offense?.counters.cards[0] ?? null, [offense]);
  const topDefenseCard = useMemo(() => defense?.threats[0] ?? null, [defense]);
  const topTrendTrait = useMemo(() => trend?.traits[0] ?? null, [trend]);

  const offenseMessage = topOffenseTrait
    ? `「${prettyKey(topOffenseTrait.trait_key)}」系に攻めを止められやすい傾向です。`
    : "止められやすい傾向はまだ特定できていません。";

  const defenseMessage = topDefenseCard
    ? `守りでは「${master?.getName(topDefenseCard.card_id) ?? `#${topDefenseCard.card_id}`}」系への対応に負荷が出やすいです。`
    : "守りの崩れ筋はまだ特定できていません。";

  const envMessage = topTrendTrait
    ? `今の環境は「${prettyKey(topTrendTrait.trait_key)}」が目立つため、構成の相性確認が重要です。`
    : "環境トレンドは十分なデータがありません。";

  const suggestions = useMemo(() => {
    const xs: string[] = [];
    if (topTrendTrait?.trait_key?.includes("aoe")) {
      xs.push("swarm偏重なら、単体高耐久ユニットへの置換を検討候補にする。");
    }
    if (topOffenseTrait?.trait_key?.includes("stun")) {
      xs.push("主要勝ち筋が止められやすい場合、回転補助カードの見直しを検討候補にする。");
    }
    if (topDefenseCard) {
      xs.push("防衛が苦しい相手への受け先を1枚増やせるか、デッキ内役割を再配分する。");
    }
    if (xs.length === 0) xs.push("まずは直近の対戦リプレイで、攻めが止まる場面と守りが崩れる場面を1つずつ確認する。");
    return xs;
  }, [topTrendTrait, topOffenseTrait, topDefenseCard]);

  return (
    <section className="mx-auto max-w-md space-y-4 px-4 pt-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">Improve</h1>
        <div className="mt-1 text-xs text-slate-500">あなたの場合の改善方向を、攻め→守り→環境の順で表示します。</div>
      </div>

      {err ? <ApiErrorPanel detail={err} /> : null}
      {loading ? <SectionCard><div className="text-sm text-slate-500">Loading improve insights...</div></SectionCard> : null}

      <SectionCard>
        <div className="text-sm font-semibold text-slate-900">🔴 Attack（攻めの止め手）</div>
        <div className="mt-2 text-sm text-slate-800">{offenseMessage}</div>
        <details className="mt-2 text-xs text-slate-600">
          <summary className="cursor-pointer">詳細を見る（補助情報）</summary>
          <div className="mt-2 space-y-1">
            {topOffenseTrait ? <div>trait遭遇率: {pct(topOffenseTrait.stats.encounter_rate)} / 勝率差: {pct(topOffenseTrait.stats.delta_vs_baseline)}</div> : null}
            {topOffenseCard ? <div>card遭遇率: {pct(topOffenseCard.stats.encounter_rate)} / 勝率差: {pct(topOffenseCard.stats.delta_vs_baseline)}</div> : null}
          </div>
        </details>
      </SectionCard>

      <SectionCard>
        <div className="text-sm font-semibold text-slate-900">🔵 Defense（守りの崩れ筋）</div>
        <div className="mt-2 text-sm text-slate-800">{defenseMessage}</div>
        <details className="mt-2 text-xs text-slate-600">
          <summary className="cursor-pointer">詳細を見る（補助情報）</summary>
          <div className="mt-2 space-y-1">
            {topDefenseCard ? <div>遭遇率: {pct(topDefenseCard.stats.encounter_rate)} / 勝率差: {pct(topDefenseCard.stats.delta_vs_baseline)}</div> : null}
          </div>
        </details>
      </SectionCard>

      <SectionCard>
        <div className="text-sm font-semibold text-slate-900">🟢 Environment（環境との相性）</div>
        <div className="mt-2 text-sm text-slate-800">{envMessage}</div>
        <details className="mt-2 text-xs text-slate-600">
          <summary className="cursor-pointer">詳細を見る（補助情報）</summary>
          <div className="mt-2 space-y-1">
            {topTrendTrait ? <div>trait平均枚数: {topTrendTrait.summary.mean_count.toFixed(2)} / 2枚以上率: {pct(topTrendTrait.summary.rate_ge_2)}</div> : null}
          </div>
        </details>
      </SectionCard>

      <SectionCard>
        <div className="text-sm font-semibold text-slate-900">🛠 改善方向（検討候補）</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
          {suggestions.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <div className="mt-2 text-[11px] text-slate-500">※ 統計的関連に基づく提案であり、因果を断定しません。</div>
      </SectionCard>
    </section>
  );
}
