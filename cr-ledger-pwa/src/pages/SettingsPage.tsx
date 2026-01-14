import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, AuthError, getPlayers } from "../api/api";
import { usePlayer } from "../lib/player";
import type { PlayersResponse } from "../api/types";

function ErrorBox({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-4">
      <div className="text-sm font-semibold text-red-200">{title}</div>
      <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-red-200/80">{detail}</pre>
    </div>
  );
}

export default function SettingsPage() {
  const nav = useNavigate();
  const { player, setPlayer, clearPlayer } = usePlayer();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PlayersResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await getPlayers();
        setData(res);
      } catch (e) {
        if (e instanceof AuthError) setErr(e.message);
        else if (e instanceof ApiError) setErr(`${e.status}\n${e.bodyText}`);
        else if (e instanceof Error) setErr(e.message);
        else setErr("Unknown error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <section className="space-y-3">
      <h1 className="text-xl font-semibold">Settings</h1>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="text-sm text-neutral-200">Selected player</div>
        <div className="mt-1 text-xs text-neutral-400">
          {player ? `${player.player_name} (${player.player_tag})` : "(none)"}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => nav("/", { replace: true })}
            className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm hover:bg-neutral-900"
          >
            Go Home
          </button>
          <button
            onClick={() => clearPlayer()}
            className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Players</div>
          {loading ? <div className="text-xs text-neutral-400">Loading...</div> : null}
        </div>

        {err ? <div className="mt-3"><ErrorBox title="Error" detail={err} /></div> : null}

        {!loading && data && data.players.length === 0 ? (
          <div className="mt-3 text-sm text-neutral-400">No players.</div>
        ) : null}

        <div className="mt-3 space-y-2">
          {data?.players.map((p) => (
            <button
              key={p.player_tag}
              onClick={() => {
                setPlayer({ player_tag: p.player_tag, player_name: p.player_name });
                nav("/", { replace: true });
              }}
              className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-left hover:bg-neutral-900"
            >
              <div className="text-sm font-semibold">{p.player_name}</div>
              <div className="mt-1 text-xs text-neutral-400">{p.player_tag}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="text-sm font-medium">Debug</div>
        <div className="mt-1 text-xs text-neutral-400">
          In prod/dev: show status + bodyText for API errors.
        </div>
      </div>
    </section>
  );
}
