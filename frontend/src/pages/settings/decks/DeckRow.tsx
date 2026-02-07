import { useRef } from "react";
import ApiErrorPanel from "../../../components/ApiErrorPanel";
import type { MyDeckCardsResponse, SlotKind } from "../../../api/types";
import { cx } from "../../../lib/cx";
import DeckThumbs from "./DeckThumbs";
import { Spinner } from "./ui";

type DeckCard = MyDeckCardsResponse["cards"][number];

function isSupportCard(c: DeckCard) {
	// slotが 8(0..8) or 9(1..9) か、slot_kind が support のどれか
	return c.slot === 8 || c.slot === 9 || c.slot_kind === "support";
}

export default function DeckRow(props: {
	myDeckKey: string;
	currentName: string;
	battles: number;

	isSelected: boolean;

	// cards
	cards?: MyDeckCardsResponse["cards"];
	cardsErr?: string | null;
	showLoadingThumbs: boolean;

	// selection
	onSelect: () => void;

	// icons
	getIconUrl: (cardId: number, slotKind: SlotKind) => string | null;

	// rename UI state (外から注入)
	editingKey: string | null;
	draftName: string;
	renameLoadingKey: string | null;
	renameErr?: string | null;

	setEditingKey: (k: string | null) => void;
	setDraftName: (v: string) => void;

	onBeginEdit: (key: string, currentName: string) => void;
	onCancelEdit: () => void;
	onCommitEdit: (key: string, currentName: string) => void;
}) {
	const inputRef = useRef<HTMLInputElement | null>(null);

	const isEditingSelected = props.isSelected && props.editingKey === props.myDeckKey;
	const isSavingSelected = props.isSelected && props.renameLoadingKey === props.myDeckKey;

	const onRowKeyDown = (ev: React.KeyboardEvent<HTMLDivElement>) => {
		if (ev.key === "Enter" || ev.key === " ") {
			ev.preventDefault();
			props.onSelect();
		}
	};

	const sorted = (props.cards ?? []).slice().sort((a, b) => a.slot - b.slot);
	const support = sorted.find(isSupportCard) ?? null;

	return (
		<div
			role="button"
			tabIndex={0}
			onKeyDown={onRowKeyDown}
			onClick={props.onSelect}
			className={cx(
				"w-full rounded-2xl border px-4 py-3 shadow-sm transition",
				"cursor-pointer select-none",
				"focus:outline-none focus:ring-2 focus:ring-blue-200",
				props.isSelected ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
			)}
		>
			<div className="flex items-start justify-between gap-3">
				{/* Left: name + 8 cards */}
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						{/* Deck name (inline edit only for selected deck) */}
						{!isEditingSelected ? (
							<div className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
								{props.currentName}
							</div>
						) : (
							<input
								ref={(el) => {
									inputRef.current = el;
								}}
								value={props.draftName}
								onChange={(e) => props.setDraftName(e.target.value)}
								onClick={(e) => e.stopPropagation()}
								onKeyDown={(e) => {
									e.stopPropagation();

									if (e.key === "Enter") {
										e.preventDefault();
										props.onCommitEdit(props.myDeckKey, props.currentName);
									} else if (e.key === "Escape") {
										e.preventDefault();
										props.onCancelEdit();
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
								autoFocus
							/>
						)}

						{/* ✏️ (selected deck only) */}
						{props.isSelected ? (
							<button
								type="button"
								disabled={isSavingSelected}
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									if (isEditingSelected) return;

									props.onBeginEdit(props.myDeckKey, props.currentName);

									queueMicrotask(() => {
										inputRef.current?.focus();
										inputRef.current?.select();
									});
								}}
								className={cx(
									"ml-1 inline-flex items-center",
									"text-slate-400 hover:text-slate-600 active:text-slate-700",
									isSavingSelected && "opacity-60"
								)}
								aria-label="Rename deck"
								title="Rename"
							>
								{isSavingSelected ? <Spinner className="h-3.5 w-3.5" /> : <span className="text-sm leading-none">✏️</span>}
							</button>
						) : null}
					</div>

					{/* thumbs (8 cards only) */}
					<div className="mt-2">
						<DeckThumbs
							cards={props.cards}
							cardsErr={props.cardsErr ?? null}
							loading={props.showLoadingThumbs}
							getIconUrl={props.getIconUrl}
							sizeClass="h-8 w-8"
						/>
					</div>

					{isEditingSelected ? <div className="mt-2 text-[11px] text-slate-500">Enter: save / Esc: cancel</div> : null}

					{/* rename error (selected deck only) */}
					{props.isSelected && props.renameErr ? (
						<div className="mt-3" onClick={(e) => e.stopPropagation()}>
							<ApiErrorPanel title="Rename error" detail={props.renameErr} />
						</div>
					) : null}
				</div>

				{/* Right: support (top) + battles (bottom) */}
				<div className="shrink-0 flex w-[44px] flex-col items-center justify-between self-stretch">
					{/* support */}
					<div className="pt-1">
						{!props.showLoadingThumbs && !props.cardsErr && support ? (
							(() => {
								const icon = props.getIconUrl(support.card_id, support.slot_kind as SlotKind);
								return (
									<div
										className="h-8 w-8"
										title={`support #${support.card_id}`}
										onClick={(e) => e.stopPropagation()}
									>
										{icon ? (
											<img
												src={icon}
												alt=""
												className="h-full w-full object-contain"
												loading="lazy"
											/>
										) : (
											<div className="flex h-full w-full items-center justify-center text-[9px] text-slate-400">?</div>
										)}
									</div>
								);
							})()
						) : (
							<div className="h-8 w-8" />
						)}
					</div>

					{/* battles */}
					<div className="pb-0.5 text-right">
						<div className="text-[10px] text-slate-500">battles</div>
						<div className="text-sm font-semibold text-slate-900">{props.battles}</div>
					</div>
				</div>
			</div>
		</div>
	);
}
