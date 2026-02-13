import ApiErrorPanel from "../../components/ApiErrorPanel";
import { useSelection } from "../../lib/selection";
import { cx } from "../../lib/cx";
import SectionCard from "../../components/SectionCard";
import { useCommonPlayers } from "../../lib/commonPlayers";

export default function Players() {
  const { player, setPlayer, clearDeckKey } = useSelection();
  const { data, loading, error } = useCommonPlayers();

  return (
    <SectionCard>
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">Players</div>
        {loading ? <div className="text-xs text-slate-500">Loading...</div> : null}
      </div>

      {error ? (
        <div className="mt-3">
          <ApiErrorPanel detail={error} />
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {data?.players.map((p) => (
          <button
            key={p.player_tag}
            onClick={() => {
              if (!player || player.player_tag !== p.player_tag) clearDeckKey();
              setPlayer({ player_tag: p.player_tag, player_name: p.player_name });
            }}
            className={cx(
              "w-full rounded-2xl border px-4 py-3 text-left shadow-sm transition",
              player?.player_tag === p.player_tag
                ? "border-blue-200 bg-blue-50"
                : "border-slate-200 bg-white hover:bg-slate-50"
            )}
          >
            <div className="text-sm font-semibold text-slate-900">{p.player_name}</div>
            <div className="mt-1 text-xs text-slate-500">{p.player_tag}</div>
            <div className="mt-1 text-[11px] text-slate-500">battles: {p.total_battles}</div>
          </button>
        ))}
      </div>
    </SectionCard>
  );
}
