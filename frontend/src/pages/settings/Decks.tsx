import { useEffect, useMemo, useState } from "react";
import ApiErrorPanel from "../../components/ApiErrorPanel";
import { updateDeckName } from "../../api/api";
import type { SlotKind } from "../../api/types";
import { toErrorText } from "../../lib/errors";
import { useSelection } from "../../lib/selection";
import { useCardMaster } from "../../cards/useCardMaster";
import SectionCard from "../../components/SectionCard";
import DeckRow from "./decks/DeckRow";
import { useCommonPlayers } from "../../lib/commonPlayers";

export default function Decks() {
	const { player, deckKey, setDeckKey } = useSelection();
	const { master } = useCardMaster();

	const { data: playersData, loading: dLoading, error: dErr, reload: reloadPlayers } = useCommonPlayers();

	const [editingKey, setEditingKey] = useState<string | null>(null);
	const [draftName, setDraftName] = useState<string>("");
	const [renameLoadingKey, setRenameLoadingKey] = useState<string | null>(null);
	const [renameErrMap, setRenameErrMap] = useState<Record<string, string>>({});

	const playerSelected = !!player;

	useEffect(() => {
		setEditingKey(null);
		setDraftName("");
		setRenameLoadingKey(null);
		setRenameErrMap({});
	}, [player?.player_tag]);

	const selectedPlayer = useMemo(
		() => playersData?.players.find((p) => p.player_tag === player?.player_tag) ?? null,
		[playersData, player?.player_tag]
	);
	const decks = selectedPlayer?.decks ?? [];

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
				await reloadPlayers();
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

			{!dLoading && playerSelected && decks.length === 0 ? (
				<div className="mt-3 text-sm text-slate-600">No decks found.</div>
			) : null}

			<div className="mt-3 space-y-2">
				{decks.map((d) => {
					const currentName = d.deck_name ?? "(no name)";
					const isSelected = deckKey === d.my_deck_key;

					return (
						<DeckRow
							key={d.my_deck_key}
							myDeckKey={d.my_deck_key}
							currentName={currentName}
							battles={d.battles}
							isSelected={isSelected}
							cards={d.cards}
							cardsErr={null}
							showLoadingThumbs={false}
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
