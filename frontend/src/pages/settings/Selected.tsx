// src/pages/setting/Selected.tsx
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import SectionCard from "../../components/SectionCard";
import ApiErrorPanel from "../../components/ApiErrorPanel";
import { useSelection } from "../../lib/selection";
import { cx } from "../../lib/cx";
import { useCommonPlayers } from "../../lib/commonPlayers";

type HintTone = "muted" | "warn";

function getHint(player: unknown, deckKey: string | null): { text: string; tone: HintTone } {
	if (!player) return { text: "Select a player first.", tone: "warn" };
	if (!deckKey) return { text: "Select a deck.", tone: "warn" };
	return { text: "Ready.", tone: "muted" };
}

export default function Selected() {
	const nav = useNavigate();
	const { player, clearPlayer, deckKey, clearDeckKey } = useSelection();

	const hint = useMemo(() => getHint(player, deckKey), [player, deckKey]);

	const playerLabel = player ? `${player.player_name} (${player.player_tag})` : "(none)";

	const { data: playersData, loading: decksLoading, error: decksErr } = useCommonPlayers();

	const selectedDeckLabel = useMemo(() => {
		if (!deckKey) return "(none)";

		const selectedPlayer = playersData?.players.find((p) => p.player_tag === player?.player_tag);
		const hit = selectedPlayer?.decks.find((d) => d.my_deck_key === deckKey);
		if (hit?.deck_name) return hit.deck_name;

		// fallback
		if (decksLoading) return "Loading…";
		return "(unknown deck)";
	}, [deckKey, playersData, player?.player_tag, decksLoading]);

	return (
		<SectionCard>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="text-sm font-semibold text-slate-900">Selected</div>

					{/* Make hint more visible */}
					<div
						className={cx(
							"mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
							hint.tone === "warn"
								? "bg-amber-100 text-amber-900"
								: "bg-slate-100 text-slate-600"
						)}
					>
						{hint.text}
					</div>
				</div>

				<div className="shrink-0">
					<button
						onClick={() => nav("/", { replace: true })}
						className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-[0.99]"
					>
						Go Home
					</button>
				</div>
			</div>

			{decksErr ? (
				<div className="mt-3">
					<ApiErrorPanel title="Decks load error" detail={decksErr} />
				</div>
			) : null}

			<div className="mt-4 grid gap-3">
				<div>
					<div className="text-xs text-slate-500">Player</div>
					<div className="mt-1 text-sm text-slate-900">{playerLabel}</div>
				</div>

				<div>
					<div className="text-xs text-slate-500">Deck</div>
					<div className="mt-1 text-sm font-semibold text-slate-900">{selectedDeckLabel}</div>
					{/* {deckKey && !decksLoading && decksData ? (
						<div className="mt-1 text-[11px] text-slate-500">
							{deckKey.length > 36 ? `${deckKey.slice(0, 36)}…` : deckKey}
						</div>
					) : null} */}
				</div>
			</div>

			<div className="mt-4 flex gap-2">
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
		</SectionCard>
	);
}
