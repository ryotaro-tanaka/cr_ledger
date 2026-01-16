import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import ApiErrorPanel from "../../components/ApiErrorPanel";
import { getPlayers } from "../../api/api";
import type { PlayersResponse } from "../../api/types";
import { toErrorText } from "../../lib/errors";
import { useSelection } from "../../lib/selection";

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

export default function Players() {
  const { player, setPlayer, clearDeckKey } = useSelection();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PlayersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getPlayers();
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(toErrorText(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
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
          </button>
        ))}
      </div>
    </Card>
  );
}
