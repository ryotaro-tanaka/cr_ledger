import SectionCard from "../../components/SectionCard";

type CardRow = {
  slot: number | null;
  card_id: number;
  slot_kind: "normal" | "evolution" | "hero" | "support";
  card_type: "unit" | "spell" | "building" | "support" | null;
  card_traits: string[];
  classes: string[];
};

type Props = {
  minimumElixirCycle: number | null;
  cards: CardRow[];
  getName: (id: number) => string;
  getIconUrl: (id: number, kind: CardRow["slot_kind"]) => string | null;
  getElixirCost: (id: number) => number | null;
  prettyKey: (k: string) => string;
  deckTraits: Array<{ trait_key: string; count: number }>;
  deckClasses: Array<{ class_key: string; count: number }>;
};

export default function DeckDataSection({
  minimumElixirCycle,
  cards,
  getName,
  getIconUrl,
  getElixirCost,
  prettyKey,
  deckTraits,
  deckClasses,
}: Props) {
  return (
    <SectionCard>
      <div className="text-sm font-semibold text-slate-900">Cards and deck data</div>
      <div className="mt-1 text-xs text-slate-500">Cards are always visible. Click a card to see traits and classes.</div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>Cards</span>
        <span>Minimum elixir cycle {minimumElixirCycle ?? "-"}</span>
      </div>

      <div className="mt-2 space-y-2">
        {cards.length === 0 ? (
          <div className="text-sm text-slate-600">No cards in this summary.</div>
        ) : (
          cards.map((c) => {
            const name = getName(c.card_id);
            const icon = getIconUrl(c.card_id, c.slot_kind);
            const isWinCondition = c.classes.some((cl) => cl.includes("win_condition"));

            return (
              <details
                key={`${c.card_id}:${c.slot_kind}`}
                className={`rounded-2xl border px-3 py-2.5 ${isWinCondition ? "border-amber-300 bg-amber-50/60" : "border-slate-200 bg-white"}`}
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 shrink-0">
                      {icon ? (
                        <img src={icon} alt="" className="h-full w-full object-contain" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">?</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-semibold text-slate-900">{name}</div>
                        {isWinCondition ? (
                          <span className="rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">WIN CON</span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        slot {c.slot ?? "?"} · {c.slot_kind} · {c.card_type ?? "-"} · elixir {getElixirCost(c.card_id) ?? "-"}
                      </div>
                    </div>
                  </div>
                </summary>

                <div className="mt-2 grid gap-1 text-xs">
                  <div>
                    <span className="text-slate-500">traits:</span>{" "}
                    <span className="text-slate-700">{c.card_traits.length ? c.card_traits.map(prettyKey).join(", ") : "-"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">classes:</span>{" "}
                    <span className="text-slate-700">{c.classes.length ? c.classes.map(prettyKey).join(", ") : "-"}</span>
                  </div>
                </div>
              </details>
            );
          })
        )}
      </div>

      <details className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
        <summary className="cursor-pointer text-xs font-semibold text-slate-600">Traits and classes summary</summary>
        <div className="mt-3 space-y-4">
          <div>
            <div className="text-xs text-slate-500">Traits</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {deckTraits.length === 0 ? (
                <div className="text-sm text-slate-600">No traits.</div>
              ) : (
                deckTraits.map((t) => (
                  <span key={t.trait_key} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                    {prettyKey(t.trait_key)} · {t.count}
                  </span>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Classes</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {deckClasses.length === 0 ? (
                <div className="text-sm text-slate-600">No classes.</div>
              ) : (
                deckClasses.map((c) => (
                  <span key={c.class_key} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                    {prettyKey(c.class_key)} · {c.count}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </details>
    </SectionCard>
  );
}
