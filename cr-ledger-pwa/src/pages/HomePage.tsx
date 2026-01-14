import React, { useState } from "react";
import { ApiError, AuthError, sync } from "../api/api";
import { usePlayer } from "../lib/player";
import type { SyncResponse } from "../api/types";

export default function HomePage() {
  const { player } = usePlayer();
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<SyncResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!player) return null; // RequirePlayerがいるので通常来ない

  return (
    <section className="space-y-3">
      <h1 className="text-xl font-semibold">Home</h1>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="text-sm text-neutral-200">Player</div>
        <div className="mt-1 text-xs text-neutral-400">
          {player.player_name} ({player.player_tag})
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              setErr(null);
              setRes(null);
              try {
                const r = await sync(player.player_tag);
                setRes(r);
              } catch (e) {
                if (e instanceof AuthError) setErr(e.message);
                else if (e instanceof ApiError) setErr(`${e.status}\n${e.bodyText}`);
                else if (e instanceof Error) setErr(e.message);
                else setErr("Unknown error");
              } finally {
                setLoading(false);
              }
            }}
            className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm hover:bg-neutral-900 disabled:opacity-60"
          >
            {loading ? "Syncing..." : "Sync now"}
          </button>

          {loading ? <div className="text-xs text-neutral-400">Working...</div> : null}
        </div>

        {err ? (
          <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-red-900/40 bg-red-950/30 p-3 text-xs text-red-200/80">
            {err}
          </pre>
        ) : null}

        {res ? (
          <pre className="mt-3 overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-200/80">
            {JSON.stringify(res, null, 2)}
          </pre>
        ) : null}
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="text-sm text-neutral-300">
          Next: summary cards (priority top 15 / trend top 15).
        </div>
      </div>
    </section>
  );
}
