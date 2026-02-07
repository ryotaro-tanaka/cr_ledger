import { useState } from "react";
import SectionCard from "../../components/SectionCard";
import ApiErrorPanel from "../../components/ApiErrorPanel";
import { cx } from "../../lib/cx";
import { sync } from "../../api/api";
import type { SyncResponse } from "../../api/types";
import { useSelection } from "../../lib/selection";
import { toErrorText } from "../../lib/errors";

export default function SyncCard() {
	const { player } = useSelection();

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<SyncResponse | null>(null);

	return (
		<SectionCard>
			<div className="flex items-center justify-between gap-3">
				<div className="min-w-0">
					<div className="text-sm font-semibold text-slate-900">Sync</div>
					<div className="mt-1 text-xs text-slate-500">
						Fetch latest battles and refresh analytics data.
					</div>
				</div>

				<button
					disabled={!player || loading}
					onClick={() => {
						if (!player) return;
						void (async () => {
							setLoading(true);
							setError(null);
							setResult(null);
							try {
								const res = await sync(player.player_tag);
								setResult(res);
							} catch (e) {
								setError(toErrorText(e));
							} finally {
								setLoading(false);
							}
						})();
					}}
					className={cx(
						"shrink-0 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition",
						!player || loading
							? "bg-slate-200 text-slate-500"
							: "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.99]"
					)}
				>
					{loading ? "Syncing..." : "Sync now"}
				</button>
			</div>

			{loading ? (
				<div className="mt-3 text-xs text-slate-500">Working…</div>
			) : null}

			{error ? (
				<div className="mt-3">
					<ApiErrorPanel detail={error} />
				</div>
			) : null}

			{result ? (
				<div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
					<div className="text-xs text-slate-500">Result</div>
					<pre className="mt-2 whitespace-pre-wrap break-words text-[11px] text-slate-700">
						{JSON.stringify(result, null, 2)}
					</pre>
				</div>
			) : null}
		</SectionCard>
	);
}
