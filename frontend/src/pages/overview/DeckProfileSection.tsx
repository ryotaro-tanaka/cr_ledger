import SectionCard from "../../components/SectionCard";

type Props = {
  loading: boolean;
  deckIdentityLines: string[];
  strengths: string[];
  weaknesses: string[];
};

export default function DeckProfileSection({ loading, deckIdentityLines, strengths, weaknesses }: Props) {
  return (
    <SectionCard>
      <div className="text-sm font-semibold text-slate-900">Deck profile</div>
      <div className="mt-1 text-xs text-slate-500">Simple summary to understand this deck quickly.</div>

      {loading ? <div className="mt-3 text-sm text-slate-500">Loading summary...</div> : null}

      {!loading ? (
        <div className="mt-4 space-y-4">
          <div className="space-y-1 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
            {deckIdentityLines.map((line) => (
              <div key={line}>- {line}</div>
            ))}
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-700">Strengths (top 3)</div>
            <ul className="mt-2 space-y-1 text-sm text-slate-800">
              {strengths.map((s) => (
                <li key={s}>✓ {s}</li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-700">Weaknesses (top 3)</div>
            <ul className="mt-2 space-y-1 text-sm text-slate-800">
              {weaknesses.map((w) => (
                <li key={w}>⚠ {w}</li>
              ))}
            </ul>
          </div>

          <details className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
            <summary className="cursor-pointer text-xs font-semibold text-slate-600">How this profile is judged</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
              <li>Deck style is inferred using `docs/deck_type.md` (Cycle/Bait/Beatdown/Control/Siege/Bridge Spam).</li>
              <li>Resistance uses simple counts of AoE / anti-air traits and classes.</li>
              <li>Cycle speed uses minimum elixir cycle (cheapest 4 cards from slots 0-7).</li>
              <li>Strengths/weaknesses are threshold-based hints, not guaranteed outcomes.</li>
            </ul>
          </details>
        </div>
      ) : null}
    </SectionCard>
  );
}
