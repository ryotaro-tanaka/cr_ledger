import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useSelection } from "../../lib/selection";

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
      {children}
    </div>
  );
}

export default function Selected() {
  const nav = useNavigate();
  const { player, clearPlayer, deckKey, clearDeckKey } = useSelection();

  const hint = !player ? "Select a player first." : !deckKey ? "Select a deck." : "Ready.";
  const playerLabel = player ? `${player.player_name} (${player.player_tag})` : "(none)";
  const selectedDeckLabel = (() => {
    if (!deckKey) return "(none)";
    const short = deckKey.length > 48 ? deckKey.slice(0, 48) + "…" : deckKey;
    return short;
  })();

  return (
    <Card>
      <div className="text-sm font-semibold text-slate-900">Selected</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>

      <div className="mt-3 grid gap-3">
        <div>
          <div className="text-xs text-slate-500">Player</div>
          <div className="mt-1 text-sm text-slate-900">{playerLabel}</div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Deck</div>
          <div className="mt-1 break-all text-sm text-slate-900">{selectedDeckLabel}</div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => nav("/", { replace: true })}
          className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-[0.99]"
        >
          Go Home
        </button>
        <button
          onClick={() => {
            clearDeckKey();
            clearPlayer();
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 active:scale-[0.99]"
        >
          Clear all
        </button>
      </div>
    </Card>
  );
}
