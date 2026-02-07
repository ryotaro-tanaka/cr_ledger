import { useEffect, useState } from "react";
import ApiErrorPanel from "../../components/ApiErrorPanel";
import { getMyDecks, updateDeckName } from "../../api/api";
import type { MyDecksResponse, SlotKind } from "../../api/types";
import { toErrorText } from "../../lib/errors";
import { useSelection } from "../../lib/selection";
import { useCardMaster } from "../../cards/useCardMaster";
import SectionCard from "../../components/SectionCard";
import DeckRow from "./decks/DeckRow";
import { useDeckCardsCache } from "./decks/useDeckCardsCache";

export default function Decks() {
	const { player, deckKey, setDeckKey } = useSelection();
	const { master } = useCardMaster();

	// decks
	const [dLoading, setDLoading] = useState(false);
	const [dData, setDData] = useState<MyDecksResponse | null>(null);
	const [dErr, setDErr] = useState<string | null>(null);

	// deck cards cache
	const { deckCardsMap, deckCardsErrMap, reset: resetDeckCardsCache } = useDeckCardsCache(dData?.decks);

	// rename UI state (keep these names)
	const [editingKey, setEditingKey] = useState<string | null>(null);
	const [draftName, setDraftName] = useState<string>("");
	const [renameLoadingKey, setRenameLoadingKey] = useState<string | null>(null);
	const [renameErrMap, setRenameErrMap] = useState<Record<string, string>>({});

	const playerSelected = !!player;

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
			resetDeckCardsCache();
			setEditingKey(null);
			setDraftName("");
			setRenameLoadingKey(null);
			setRenameErrMap({});
			return;
		}

		void reloadDecks(player.player_tag);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [player?.player_tag]);

	const beginInlineEditSelected = (selectedKey: string, currentName: string) => {
		setRenameErrMap((prev) => {
			const copy = { ...prev };
			delete copy[selectedKey];
			return copy;
		});

		setEditingKey(selectedKey);
		setDraftName(currentName);
	};

	const cancelInlineEdit = () => {
		if (renameLoadingKey) return;
		setEditingKey(null);
		setDraftName("");
	};

	const commitInlineEdit = (selectedKey: string, currentName: string) => {
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

		void (async () => {
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
		})();
	};

	const getIconUrl = (cardId: number, slotKind: SlotKind) => {
		return master?.getIconUrl(cardId, slotKind) ?? null;
	};

	return (
		<SectionCard>
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
					const cardsErr = deckCardsErrMap[d.my_deck_key] ?? null;

					const isSelected = deckKey === d.my_deck_key;
					const showLoadingThumbs = playerSelected && !cards && !cardsErr;

					return (
						<DeckRow
							key={d.my_deck_key}
							myDeckKey={d.my_deck_key}
							currentName={currentName}
							battles={d.battles}
							isSelected={isSelected}
							cards={cards}
							cardsErr={cardsErr}
							showLoadingThumbs={showLoadingThumbs}
							onSelect={() => setDeckKey(d.my_deck_key)}
							getIconUrl={getIconUrl}
							editingKey={editingKey}
							draftName={draftName}
							renameLoadingKey={renameLoadingKey}
							renameErr={isSelected ? renameErrMap[d.my_deck_key] ?? null : null}
							setEditingKey={setEditingKey}
							setDraftName={setDraftName}
							onBeginEdit={beginInlineEditSelected}
							onCancelEdit={cancelInlineEdit}
							onCommitEdit={commitInlineEdit}
						/>
					);
				})}
			</div>
		</SectionCard>
	);
}
