import SectionCard from "../../components/SectionCard";
import type { ActionPlan, CardMaster, Issue, OffenseBarItem, WhyTab } from "./useImproveInsights";

function pct(v: number): string {
  return `${Math.round(v * 1000) / 10}%`;
}

function signedPct(v: number): string {
  const raw = Math.round(v * 1000) / 10;
  return `${raw > 0 ? "+" : ""}${raw}%`;
}

function CardThumbGrid({
  cards,
  master,
}: {
  cards: Array<{ card_id: number; slot_kind: "normal" | "evolution" | "hero" | "support" }>;
  master: CardMaster;
}) {
  if (!cards.length) return <div className="text-xs text-slate-500">No cards.</div>;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {cards.map((c) => {
        const icon =
          master?.getIconUrl(c.card_id, c.slot_kind) ??
          master?.getIconUrl(c.card_id, "normal") ??
          master?.getIconUrl(c.card_id, "evolution") ??
          master?.getIconUrl(c.card_id, "hero") ??
          master?.getIconUrl(c.card_id, "support") ??
          null;
        const name = master?.getName(c.card_id) ?? `#${c.card_id}`;
        return (
          <div key={`${c.card_id}:${c.slot_kind}`} className="h-10 w-10 overflow-hidden rounded-lg border border-slate-200 bg-white" title={`${name} (${c.slot_kind}) / ${c.card_id}`}>
            {icon ? <img src={icon} alt={name} className="h-full w-full object-contain" loading="lazy" /> : <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">?</div>}
          </div>
        );
      })}
    </div>
  );
}

export function IssueSection({
  attackIssue,
  defenseIssue,
  priorityIssue,
  master,
}: {
  attackIssue: Issue | null;
  defenseIssue: Issue | null;
  priorityIssue: Issue | null;
  master: CardMaster;
}) {
  const issueLine = priorityIssue
    ? priorityIssue.side === "attack"
      ? `Your attack is often stopped by ${priorityIssue.label} (win-rate ${signedPct(priorityIssue.deltaVsBaseline)})`
      : `Your defense often breaks against ${priorityIssue.label} (win-rate ${signedPct(priorityIssue.deltaVsBaseline)})`
    : "Not enough data to decide a top priority";

  return (
    <SectionCard>
      <div className="text-sm font-semibold text-slate-900">Issue</div>
      <div className="mt-2 text-sm font-semibold text-slate-900">{issueLine}</div>
      <div className="mt-1 text-xs text-slate-600">Attack Issue: {attackIssue ? `${attackIssue.label} / EL ${attackIssue.expectedLoss.toFixed(1)}` : "Not enough data"}</div>
      <div className="mt-1 text-xs text-slate-600">Defense Issue: {defenseIssue ? `${defenseIssue.label} / EL ${defenseIssue.expectedLoss.toFixed(1)}` : "Not enough data"}</div>
      <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Decision: Prioritize {priorityIssue?.side === "defense" ? "Defense" : "Attack"} first
        {priorityIssue ? ` (encounter ${pct(priorityIssue.encounterRate)} / battles ${priorityIssue.battles})` : ""}
      </div>
      {priorityIssue ? (
        <details className="mt-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
          <summary className="cursor-pointer text-xs font-semibold text-slate-600">Example cards</summary>
          <CardThumbGrid cards={priorityIssue.exampleCards ?? []} master={master} />
        </details>
      ) : null}
    </SectionCard>
  );
}

export function WhySection({
  whyTab,
  setWhyTab,
  offenseCompare,
  defenseBars,
  trendTopWinCons,
  master,
}: {
  whyTab: WhyTab;
  setWhyTab: (tab: WhyTab) => void;
  offenseCompare: OffenseBarItem[];
  defenseBars: Array<{ key: string; label: string; expectedLoss: number; encounterRate: number; deltaVsBaseline: number }>;
  trendTopWinCons: Array<{ name: string; rate: number }>;
  master: CardMaster;
}) {
  const maxEnv = Math.max(...offenseCompare.map((i) => i.envAvgCount), 0.001);
  const maxMy = Math.max(...offenseCompare.map((i) => i.myDeckCount), 0.001);
  const maxLoss = Math.max(...defenseBars.map((x) => x.expectedLoss), 0.001);

  return (
    <SectionCard>
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">Why</div>
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-xs">
          <button onClick={() => setWhyTab("attack")} className={`rounded-lg px-2 py-1 ${whyTab === "attack" ? "bg-white text-slate-900" : "text-slate-600"}`}>Attack</button>
          <button onClick={() => setWhyTab("defense")} className={`rounded-lg px-2 py-1 ${whyTab === "defense" ? "bg-white text-slate-900" : "text-slate-600"}`}>Defense</button>
        </div>
      </div>

      {whyTab === "attack" ? (
        !offenseCompare.length ? <div className="mt-2 text-xs text-slate-500">Not enough data to show this yet.</div> : (
          <div className="mt-2 space-y-3">
            {offenseCompare.map((i) => (
              <div key={i.key} className="rounded-xl border border-slate-200 bg-white p-2">
                <div className="text-xs font-semibold text-slate-900">{i.label}</div>
                <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                  <div>
                    <div>Meta average {i.envAvgCount.toFixed(2)} cards</div>
                    <div className="mt-1 h-1.5 rounded bg-slate-100"><div className="h-full rounded bg-indigo-500" style={{ width: `${(i.envAvgCount / maxEnv) * 100}%` }} /></div>
                  </div>
                  <div>
                    <div>Your deck {i.myDeckCount} cards</div>
                    <div className="mt-1 h-1.5 rounded bg-slate-100"><div className="h-full rounded bg-emerald-500" style={{ width: `${(i.myDeckCount / Math.max(maxMy, 1)) * 100}%` }} /></div>
                  </div>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">Win-rate delta {signedPct(i.deltaVsBaseline)} / EL {i.expectedLoss.toFixed(1)}</div>
                <details className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <summary className="cursor-pointer text-[11px] font-semibold text-slate-600">Trait cards</summary>
                  <CardThumbGrid cards={i.traitCards} master={master} />
                </details>
              </div>
            ))}
          </div>
        )
      ) : (
        !defenseBars.length ? <div className="mt-2 text-xs text-slate-500">Not enough data to show this yet.</div> : (
          <div className="mt-2 space-y-2">
            {defenseBars.map((x) => (
              <div key={x.key}>
                <div className="flex items-center justify-between text-xs text-slate-700"><span>{x.label}</span><span>EL {x.expectedLoss.toFixed(1)} / Win-rate delta {signedPct(x.deltaVsBaseline)}</span></div>
                <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-rose-500" style={{ width: `${(x.expectedLoss / maxLoss) * 100}%` }} /></div>
                <div className="mt-1 text-[11px] text-slate-500">Encounter {pct(x.encounterRate)}</div>
              </div>
            ))}
          </div>
        )
      )}

      {trendTopWinCons.length ? <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">Meta win conditions Top 3: {trendTopWinCons.map((x) => `${x.name} ${pct(x.rate)}`).join(" / ")}</div> : null}
    </SectionCard>
  );
}

export function ActionSection({
  actions,
  selectedActionId,
  selectedAction,
  setSelectedActionId,
}: {
  actions: ActionPlan[];
  selectedActionId: string | null;
  selectedAction: ActionPlan | null;
  setSelectedActionId: (id: string) => void;
}) {
  return (
    <SectionCard>
      <div className="text-sm font-semibold text-slate-900">Action</div>
      {selectedAction ? <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">Pinned note: {selectedAction.title}</div> : null}
      <div className="mt-3 space-y-3">
        {actions.map((a) => (
          <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="text-sm font-semibold text-slate-900">{a.title}</div>
            <div className="mt-1 text-xs text-slate-600">Why now: {a.reason}</div>
            <div className="mt-1 text-xs text-slate-500">{a.currentState}</div>
            <div className="mt-1 text-[11px] text-slate-500">Validate in the next 5 matches: {a.checks.join(" / ")}</div>
            <button onClick={() => setSelectedActionId(a.id)} className={`mt-2 rounded-xl px-3 py-1.5 text-xs font-medium ${selectedActionId === a.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>Select</button>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[11px] text-slate-500">Suggestions are based on statistical correlation, not guaranteed causation.</div>
    </SectionCard>
  );
}
