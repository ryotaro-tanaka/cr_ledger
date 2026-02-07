import type { MyDeckCardsResponse, SlotKind } from "../../../api/types";
import { cx } from "../../../lib/cx";

function isMainSlot(slot: number) {
	return slot >= 0 && slot <= 7;
}

export default function DeckThumbs(props: {
	cards?: MyDeckCardsResponse["cards"];
	cardsErr?: string | null;
	loading?: boolean;

	getIconUrl: (cardId: number, slotKind: SlotKind) => string | null;

	// サイズはここで一括管理
	sizeClass?: string; // 例: "h-8 w-8"
}) {
	const sizeClass = props.sizeClass ?? "h-8 w-8";

	if (props.loading) {
		return <div className="text-xs text-slate-500">Loading cards…</div>;
	}
	if (props.cardsErr) {
		return <div className="text-xs text-slate-600">Cards load failed.</div>;
	}

	const sorted = (props.cards ?? []).slice().sort((a, b) => a.slot - b.slot);
	const main8 = sorted.filter((c) => isMainSlot(c.slot)).slice(0, 8);

	if (main8.length === 0) {
		return <div className="text-xs text-slate-600">No cards.</div>;
	}

	return (
		<div className="grid grid-cols-4 gap-1">
			{main8.map((c) => {
				const icon = props.getIconUrl(c.card_id, c.slot_kind as SlotKind);

				return (
					<div
						key={`${c.slot}:${c.card_id}:${c.slot_kind}`}
						className={cx(sizeClass)}
						title={`${c.slot_kind} #${c.card_id}`}
					>
						{icon ? (
							<img
								src={icon}
								alt=""
								className={cx("h-full w-full object-contain")}
								loading="lazy"
							/>
						) : (
							<div className={cx("flex h-full w-full items-center justify-center text-[9px] text-slate-400")}>
								?
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
