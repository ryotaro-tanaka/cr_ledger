import React, { useMemo, useState } from "react";
import { useParams } from "react-router-dom";

type Tab = "priority" | "matchup";

export default function DeckDetailPage() {
  const { deckKey } = useParams();
  const decodedKey = useMemo(() => {
    if (!deckKey) return "";
    try {
      return decodeURIComponent(deckKey);
    } catch {
      return deckKey;
    }
  }, [deckKey]);

  const [tab, setTab] = useState<Tab>("priority");

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Deck Detail</h1>
        <div className="text-xs text-neutral-400 break-all">
          {decodedKey || "(no deckKey)"}
        </div>
      </div>

      {/* segmented tabs */}
      <div className="flex rounded-2xl border border-neutral-800 bg-neutral-900/40 p-1">
        <button
          onClick={() => setTab("priority")}
          className={[
            "w-1/2 rounded-xl px-3 py-2 text-sm font-medium",
            tab === "priority"
              ? "bg-neutral-950 text-white"
              : "text-neutral-300 hover:text-neutral-100",
          ].join(" ")}
        >
          Priority
        </button>
        <button
          onClick={() => setTab("matchup")}
          className={[
            "w-1/2 rounded-xl px-3 py-2 text-sm font-medium",
            tab === "matchup"
              ? "bg-neutral-950 text-white"
              : "text-neutral-300 hover:text-neutral-100",
          ].join(" ")}
        >
          Matchup
        </button>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="text-sm text-neutral-300">
          {tab === "priority"
            ? "Priority list will be here (15 + infinite scroll)."
            : "Matchup list will be here (15 + infinite scroll)."}
        </div>
      </div>
    </section>
  );
}
