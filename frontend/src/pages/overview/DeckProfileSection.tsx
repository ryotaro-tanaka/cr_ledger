import SectionCard from "../../components/SectionCard";

type Props = {
  loading: boolean;
  deckIdentityLines: string[];
  tacticalNotes: string[];
  typeScoreNote: string | null;
  strengths: string[];
  weaknesses: string[];
};

export default function DeckProfileSection({ loading, deckIdentityLines, tacticalNotes, typeScoreNote, strengths, weaknesses }: Props) {
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
            <div className="text-xs font-semibold text-slate-700">Type-based tactical notes</div>
            <ul className="mt-2 space-y-1 text-sm text-slate-800">
              {tacticalNotes.map((note) => (
                <li key={note}>• {note}</li>
              ))}
            </ul>
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
              <li>Deck type is scored by multiple signals (avg elixir / traits / win-condition profile), not fixed priority order.</li>
              <li>When top scores are close, style is shown as Mixed with top 2 candidates.</li>
              {typeScoreNote ? <li>{typeScoreNote}</li> : null}
              <li>Resistance is heuristic (Air/Swarm/Giant/Building) and for quick reading only.</li>
              <li>Strengths/weaknesses are threshold-based hints, not guaranteed outcomes.</li>
            </ul>
          </details>
        </div>
      ) : null}
    </SectionCard>
  );
}
