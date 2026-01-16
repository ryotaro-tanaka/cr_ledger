import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import ApiErrorPanel from "../../components/ApiErrorPanel";
import { getMyDeckCards, getMyDecks, updateDeckName } from "../../api/api";
import type { MyDeckCardsResponse, MyDecksResponse, SlotKind } from "../../api/types";
import { toErrorText } from "../../lib/errors";
import { useSelection } from "../../lib/selection";
import { useCardMaster } from "../../cards/useCardMaster";

function cx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
      {children}
    </div>
  );
}

export default function Decks() {
  const { player, deckKey, setDeckKey } = useSelection();

  // card master (for thumbs)
  const { master, loading: cardsLoading } = useCardMaster();

  // decks
  const [dLoading, setDLoading] = useState(false);
  const [dData, setDData] = useState<MyDecksResponse | null>(null);
  const [dErr, setDErr] = useState<string | null>(null);

  // deck cards (my-deck-cards)
  const [deckCardsMap, setDeckCardsMap] = useState<Record<string, MyDeckCardsResponse["cards"]>>({});
  const [deckCardsErrMap, setDeckCardsErrMap] = useState<Record<string, string>>({});

  // rename UI state
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftName, setDraftName] = useState<string>("");
  const [renameLoadingKey, setRenameLoadingKey] = useState<string | null>(null);
  const [renameErrMap, setRenameErrMap] = useState<Record<string, string>>({});

  const reloadDecks = async (playerTag: string) => {
    setDLoading(true);
    setDErr(null);
    try {
      const res = await getMyDecks(playerTag, 200);
      setDData(res);
      return res;
    } catch (e) {
      const msg = toErrorText(e);
      setDErr(msg);
      return null;
    } finally {
      setDLoading(false);
    }
  };

  // load decks when player changes
  useEffect(() => {
    if (!player) {
      setDData(null);
      setDeckCardsMap({});
      setDeckCardsErrMap({});
      setEditingKey(null);
      setDraftName("");
      return;
    }
    void reloadDecks(player.player_tag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.player_tag]);

  // fetch deck cards for visible decks (cache in state)
  useEffect(() => {
    if (!dData?.decks?.length) return;

    void (async () => {
      const targets = dData.decks
        .map((d) => d.my_deck_key)
        .filter((k) => !(k in deckCardsMap) && !(k in deckCardsErrMap));

      if (targets.length === 0) return;

      // avoid huge burst
      const limited = targets.slice(0, 30);

      await Promise.all(
        limited.map(async (k) => {
          try {
            const res = await getMyDeckCards(k);
            const sorted = [...res.cards].sort((a, b) => a.slot - b.slot);
            setDeckCardsMap((prev) => ({ ...prev, [k]: sorted }));
          } catch (e) {
            setDeckCardsErrMap((prev) => ({ ...prev, [k]: toErrorText(e) }));
          }
        })
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dData]);

  const playerSelected = !!player;

  const anyThumbHint = useMemo(() => {
    if (!playerSelected) return null;
    if (cardsLoading) return "Loading card images...";
    if (!master) return null;
    return null;
  }, [playerSelected, cardsLoading, master]);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">Decks</div>
        {dLoading ? <div className="text-xs text-slate-500">Loading...</div> : null}
      </div>

      {!playerSelected ? <div className="mt-3 text-sm text-slate-600">Select a player to load decks.</div> : null}

      {dErr ? (
        <div className="mt-3">
          <ApiErrorPanel detail={dErr} />
        </div>
      ) : null}

      {!dLoading && playerSelected && dData && dData.decks.length === 0 ? (
        <div className="mt-3 text-sm text-slate-600">No decks found.</div>
      ) : null}

      <div className="mt-3 space-y-2">
        {dData?.decks.map((d) => {
          const name = d.deck_name ?? "(no name)";
          const cards = deckCardsMap[d.my_deck_key];
          const cardsErr = deckCardsErrMap[d.my_deck_key];

          const isSelected = deckKey === d.my_deck_key;
          const isEditing = editingKey === d.my_deck_key;

          const showLoadingThumbs = !!player && !cards && !cardsErr;

          const thumbs = (cards ?? []).slice(0, 9).map((c) => {
            const icon = master?.getIconUrl(c.card_id, c.slot_kind as SlotKind) ?? null;
            return { slot: c.slot, card_id: c.card_id, slot_kind: c.slot_kind as SlotKind, icon };
          });

          return (
            <div
              key={d.my_deck_key}
              className={cx(
                "w-full rounded-2xl border px-4 py-3 shadow-sm transition",
                isSelected ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => setDeckKey(d.my_deck_key)} className="min-w-0 flex-1 text-left">
                  <div className="truncate text-sm font-semibold text-slate-900">{name}</div>

                  {/* 9 tiny icons */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {showLoadingThumbs ? (
                      <div className="text-xs text-slate-500">Loading cards…</div>
                    ) : cardsErr ? (
                      <div className="text-xs text-slate-600">Cards load failed.</div>
                    ) : thumbs.length === 0 ? (
                      <div className="text-xs text-slate-600">No cards.</div>
                    ) : (
                      thumbs.map((c) => (
                        <div
                          key={`${c.slot}:${c.card_id}:${c.slot_kind}`}
                          className="h-7 w-7 overflow-hidden rounded-lg border border-slate-200 bg-white"
                          title={`${c.slot_kind} #${c.card_id}`}
                        >
                          {c.icon ? (
                            <img src={c.icon} alt="" className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-[9px] text-slate-400">?</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </button>

                <div className="shrink-0 text-right">
                  <div className="text-[10px] text-slate-500">battles</div>
                  <div className="text-sm font-semibold text-slate-900">{d.battles}</div>

                  <div className="mt-2 flex justify-end gap-2">
                    {!isEditing ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingKey(d.my_deck_key);
                          setDraftName(name);
                          setRenameErrMap((prev) => {
                            const copy = { ...prev };
                            delete copy[d.my_deck_key];
                            return copy;
                          });
                        }}
                        className="text-xs font-semibold text-blue-700 hover:text-blue-800"
                      >
                        Rename
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Rename editor (existing UI; you’ll swap to ✏️ inline later) */}
              {isEditing ? (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-semibold text-slate-700">Rename deck</div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      placeholder="Deck name"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                      type="button"
                      disabled={renameLoadingKey === d.my_deck_key}
                      onClick={() => {
                        const next = draftName.trim();
                        if (!next) {
                          setRenameErrMap((prev) => ({ ...prev, [d.my_deck_key]: "Deck name is required." }));
                          return;
                        }
                        if (!player) return;

                        void (async () => {
                          setRenameLoadingKey(d.my_deck_key);
                          setRenameErrMap((prev) => {
                            const copy = { ...prev };
                            delete copy[d.my_deck_key];
                            return copy;
                          });

                          try {
                            await updateDeckName(d.my_deck_key, next);
                            await reloadDecks(player.player_tag);
                            setEditingKey(null);
                            setDraftName("");
                          } catch (e) {
                            setRenameErrMap((prev) => ({ ...prev, [d.my_deck_key]: toErrorText(e) }));
                          } finally {
                            setRenameLoadingKey(null);
                          }
                        })();
                      }}
                      className={cx(
                        "shrink-0 rounded-xl px-3 py-2 text-sm font-semibold shadow-sm transition active:scale-[0.99]",
                        renameLoadingKey === d.my_deck_key ? "bg-slate-200 text-slate-500" : "bg-blue-600 text-white hover:bg-blue-700"
                      )}
                    >
                      {renameLoadingKey === d.my_deck_key ? "Saving..." : "Save"}
                    </button>

                    <button
                      type="button"
                      disabled={renameLoadingKey === d.my_deck_key}
                      onClick={() => {
                        setEditingKey(null);
                        setDraftName("");
                      }}
                      className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 active:scale-[0.99]"
                    >
                      Cancel
                    </button>
                  </div>

                  {renameErrMap[d.my_deck_key] ? (
                    <div className="mt-3">
                      <ApiErrorPanel title="Rename error" detail={renameErrMap[d.my_deck_key]} />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {anyThumbHint ? <div className="mt-3 text-xs text-slate-500">{anyThumbHint}</div> : null}
    </Card>
  );
}
