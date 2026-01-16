// src/pages/setting/Decks.tsx
import { useEffect, useRef, useState } from "react";
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

function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-block animate-spin rounded-full border-2 border-black/20 border-t-black/70",
        className ?? "h-4 w-4"
      )}
      aria-hidden="true"
    />
  );
}

export default function Decks() {
  const { player, deckKey, setDeckKey } = useSelection();
  const { master } = useCardMaster();

  // decks
  const [dLoading, setDLoading] = useState(false);
  const [dData, setDData] = useState<MyDecksResponse | null>(null);
  const [dErr, setDErr] = useState<string | null>(null);

  // deck cards cache
  const [deckCardsMap, setDeckCardsMap] = useState<Record<string, MyDeckCardsResponse["cards"]>>({});
  const [deckCardsErrMap, setDeckCardsErrMap] = useState<Record<string, string>>({});

  // rename UI state (keep these names)
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftName, setDraftName] = useState<string>("");
  const [renameLoadingKey, setRenameLoadingKey] = useState<string | null>(null);
  const [renameErrMap, setRenameErrMap] = useState<Record<string, string>>({});

  const inputRef = useRef<HTMLInputElement | null>(null);

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
      setRenameLoadingKey(null);
      setRenameErrMap({});
      return;
    }
    void reloadDecks(player.player_tag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.player_tag]);

  // fetch deck cards (cache)
  useEffect(() => {
    if (!dData?.decks?.length) return;

    let cancelled = false;

    void (async () => {
      const targets = dData.decks
        .map((d) => d.my_deck_key)
        .filter((k) => !(k in deckCardsMap) && !(k in deckCardsErrMap));

      if (targets.length === 0) return;

      const limited = targets.slice(0, 30);

      await Promise.all(
        limited.map(async (k) => {
          try {
            const res = await getMyDeckCards(k);
            const sorted = [...res.cards].sort((a, b) => a.slot - b.slot);
            if (!cancelled) setDeckCardsMap((prev) => ({ ...prev, [k]: sorted }));
          } catch (e) {
            if (!cancelled) setDeckCardsErrMap((prev) => ({ ...prev, [k]: toErrorText(e) }));
          }
        })
      );
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dData]);

  const playerSelected = !!player;

  const beginInlineEditSelected = (selectedKey: string, currentName: string) => {
    // clear error for this deck
    setRenameErrMap((prev) => {
      const copy = { ...prev };
      delete copy[selectedKey];
      return copy;
    });
    setEditingKey(selectedKey);
    setDraftName(currentName);

    queueMicrotask(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const cancelInlineEdit = () => {
    if (renameLoadingKey) return;
    setEditingKey(null);
    setDraftName("");
  };

  const commitInlineEdit = async (selectedKey: string, currentName: string) => {
    if (!player) return;
    if (renameLoadingKey) return;

    const next = draftName.trim();
    if (!next) {
      setRenameErrMap((prev) => ({ ...prev, [selectedKey]: "Deck name is required." }));
      return;
    }
    if (next === currentName.trim()) {
      cancelInlineEdit();
      return;
    }

    setRenameLoadingKey(selectedKey);
    setRenameErrMap((prev) => {
      const copy = { ...prev };
      delete copy[selectedKey];
      return copy;
    });

    try {
      await updateDeckName(selectedKey, next);
      await reloadDecks(player.player_tag);
      setEditingKey(null);
      setDraftName("");
    } catch (e) {
      setRenameErrMap((prev) => ({ ...prev, [selectedKey]: toErrorText(e) }));
    } finally {
      setRenameLoadingKey(null);
    }
  };

  const onRowKeyDown = (ev: React.KeyboardEvent<HTMLDivElement>, key: string) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      setDeckKey(key);
    }
  };

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
          const currentName = d.deck_name ?? "(no name)";
          const cards = deckCardsMap[d.my_deck_key];
          const cardsErr = deckCardsErrMap[d.my_deck_key];

          const isSelected = deckKey === d.my_deck_key;
          const isEditingSelected = isSelected && editingKey === d.my_deck_key;
          const isSavingSelected = isSelected && renameLoadingKey === d.my_deck_key;

          const showLoadingThumbs = playerSelected && !cards && !cardsErr;

          const thumbs = (cards ?? []).slice(0, 9).map((c) => {
            const icon = master?.getIconUrl(c.card_id, c.slot_kind as SlotKind) ?? null;
            return { slot: c.slot, card_id: c.card_id, slot_kind: c.slot_kind as SlotKind, icon };
          });

          return (
            <div
              key={d.my_deck_key}
              role="button"
              tabIndex={0}
              onKeyDown={(ev) => onRowKeyDown(ev, d.my_deck_key)}
              onClick={() => setDeckKey(d.my_deck_key)}
              className={cx(
                "w-full rounded-2xl border px-4 py-3 shadow-sm transition",
                "cursor-pointer select-none",
                "focus:outline-none focus:ring-2 focus:ring-blue-200",
                isSelected ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {/* Deck name (inline edit only for selected deck) */}
                    {!isEditingSelected ? (
                      <div className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                        {currentName}
                      </div>
                    ) : (
                      <input
                        ref={inputRef}
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          // prevent row key handling while typing
                          e.stopPropagation();

                          if (e.key === "Enter") {
                            e.preventDefault();
                            void commitInlineEdit(d.my_deck_key, currentName);
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            cancelInlineEdit();
                          }
                        }}
                        disabled={isSavingSelected}
                        className={cx(
                          "w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 outline-none",
                          "border-slate-200 focus:border-blue-200 focus:ring-2 focus:ring-blue-100",
                          isSavingSelected && "opacity-70"
                        )}
                        placeholder="Deck name"
                        inputMode="text"
                        autoCapitalize="sentences"
                        autoCorrect="on"
                      />
                    )}

                    {/* ✏️ (selected deck only) */}
                    {isSelected ? (
                        <button
                            type="button"
                            disabled={isSavingSelected}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (isEditingSelected) return;
                                beginInlineEditSelected(d.my_deck_key, currentName);
                            }}
                            className={cx(
                                "ml-1 inline-flex items-center",
                                "text-slate-400",
                                "hover:text-slate-600",
                                "active:text-slate-700",
                                isSavingSelected && "opacity-60"
                            )}
                            aria-label="Rename deck"
                            title="Rename"
                            >
                            {isSavingSelected ? (
                                <Spinner className="h-3.5 w-3.5" />
                            ) : (
                                <span className="text-sm leading-none">✏️</span>
                            )}
                        </button>
                    ) : null}
                  </div>

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
                          onClick={(e) => e.stopPropagation()}
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

                  {/* edit hint */}
                  {isEditingSelected ? (
                    <div className="mt-2 text-[11px] text-slate-500">Enter: save / Esc: cancel</div>
                  ) : null}

                  {/* rename error (selected deck only) */}
                  {isSelected && renameErrMap[d.my_deck_key] ? (
                    <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                      <ApiErrorPanel title="Rename error" detail={renameErrMap[d.my_deck_key]} />
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-[10px] text-slate-500">battles</div>
                  <div className="text-sm font-semibold text-slate-900">{d.battles}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
