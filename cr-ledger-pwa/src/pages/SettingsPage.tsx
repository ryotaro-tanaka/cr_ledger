import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyDecks, getPlayers } from "../api/api";
import type { MyDecksResponse, PlayersResponse } from "../api/types";
import { useSelection } from "../lib/selection";
import { toErrorText } from "../lib/errors";
import ApiErrorPanel from "../components/ApiErrorPanel";
import { useCardMaster } from "../cards/useCardMaster";

function isStandalonePWA(): boolean {
  const mql = window.matchMedia?.("(display-mode: standalone)");
  const displayModeStandalone = !!mql?.matches;

  // iOS Safari legacy: navigator.standalone (boolean)
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const iosStandalone = nav.standalone === true;

  return displayModeStandalone || iosStandalone;
}

function getInstallHint() {
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);

  // On iOS, all browsers are effectively WebKit/Safari underneath.
  if (isIOS) {
    return {
      title: "Install on iPhone (Safari)",
      steps: [
        "Open this site in Safari.",
        "Tap the Share button (square with arrow).",
        'Tap "Add to Home Screen".',
        'Enable "Open as Web App" (if the toggle is shown).',
        "Launch from the Home Screen icon.",
      ],
      note: "If you see the URL bar inside the installed app, you may be opening an old icon or a different domain.",
    };
  }

  if (isAndroid) {
    return {
      title: "Install on Android (Chrome)",
      steps: [
        "Open this site in Chrome.",
        "Tap the ︙ menu.",
        'Tap "Install app" or "Add to Home screen".',
        "Launch from the installed icon.",
      ],
      note: "If the install option doesn’t appear, the site may be missing PWA files (manifest/service worker) or you’re not on HTTPS.",
    };
  }

  return {
    title: "Install as PWA",
    steps: [
      "Use Chrome on Android or Safari on iPhone.",
      "Look for “Install app” / “Add to Home screen”.",
      "Launch from the installed icon.",
    ],
    note: "Desktop browsers may show different UI.",
  };
}

export default function SettingsPage() {
  const nav = useNavigate();
  const { player, setPlayer, clearPlayer, deckKey, setDeckKey, clearDeckKey } = useSelection();

  const standalone = isStandalonePWA();
  const installHint = useMemo(() => getInstallHint(), []);

  // cards refresh
  const { refresh: refreshCards, loading: cardsLoading, error: cardsError } = useCardMaster();

  // players
  const [pLoading, setPLoading] = useState(false);
  const [pData, setPData] = useState<PlayersResponse | null>(null);
  const [pErr, setPErr] = useState<string | null>(null);

  // decks
  const [dLoading, setDLoading] = useState(false);
  const [dData, setDData] = useState<MyDecksResponse | null>(null);
  const [dErr, setDErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setPLoading(true);
      setPErr(null);
      try {
        const res = await getPlayers();
        setPData(res);
      } catch (e) {
        setPErr(toErrorText(e));
      } finally {
        setPLoading(false);
      }
    })();
  }, []);

  // playerが選ばれたら decks をロード
  useEffect(() => {
    if (!player) {
      setDData(null);
      return;
    }
    void (async () => {
      setDLoading(true);
      setDErr(null);
      try {
        const res = await getMyDecks(player.player_tag, 200);
        setDData(res);
      } catch (e) {
        setDErr(toErrorText(e));
      } finally {
        setDLoading(false);
      }
    })();
  }, [player]);

  const selectedDeckLabel = useMemo(() => {
    if (!deckKey) return "(none)";
    const short = deckKey.length > 40 ? deckKey.slice(0, 40) + "…" : deckKey;
    return short;
  }, [deckKey]);

  const hint = !player ? "Select a player first." : !deckKey ? "Select a deck." : "Ready.";

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <div className="text-xs text-neutral-400">{hint}</div>
        </div>
        <div className="text-xs" style={{ color: "var(--muted)" }}>standalone: {String(standalone)}</div>
      </div>

      {/* Install guide (only when not standalone) */}
      {!standalone ? (
        <div
          className="rounded-2xl border p-4"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{installHint.title}</div>
              <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                Install to remove the URL bar and use the app like a native screen.
              </div>
            </div>
            <div
              className="rounded-full px-2 py-1 text-[11px] font-medium"
              style={{ background: "var(--considerBg, rgba(43,108,176,0.12))", color: "var(--accent)" }}
            >
              PWA
            </div>
          </div>

          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
            {installHint.steps.map((s, i) => (
              <li key={i} className="leading-6">
                {s}
              </li>
            ))}
          </ol>

          {/* 強調テキスト（iPhone向け注意） */}
          <div className="mt-2 text-xs text-blue-200">
            On iPhone, make sure <span className="font-semibold">“Open as Web App”</span> is enabled —
            otherwise the URL bar will remain visible.
          </div>

          <div className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
            Note: {installHint.note}
          </div>
        </div>
      ) : null}

      {/* Selected */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="text-sm font-medium">Selected</div>

        <div className="mt-2 text-xs text-neutral-400">Player</div>
        <div className="mt-1 text-sm text-neutral-200">
          {player ? `${player.player_name} (${player.player_tag})` : "(none)"}
        </div>

        <div className="mt-3 text-xs text-neutral-400">Deck</div>
        <div className="mt-1 text-sm text-neutral-200 break-all">{selectedDeckLabel}</div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => nav("/", { replace: true })}
            className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm hover:bg-neutral-900"
          >
            Go Home
          </button>
          <button
            onClick={() => {
              clearDeckKey();
              clearPlayer();
            }}
            className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
          >
            Clear all
          </button>
        </div>
      </div>

      {/* Players */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Players</div>
          {pLoading ? <div className="text-xs text-neutral-400">Loading...</div> : null}
        </div>

        {pErr ? (
          <div className="mt-3">
            <ApiErrorPanel detail={pErr} />
          </div>
        ) : null}

        <div className="mt-3 space-y-2">
          {pData?.players.map((p) => (
            <button
              key={p.player_tag}
              onClick={() => {
                // playerを変えたら deck はクリア（混在防止）
                if (!player || player.player_tag !== p.player_tag) {
                  clearDeckKey();
                }
                setPlayer({ player_tag: p.player_tag, player_name: p.player_name });
              }}
              className={[
                "w-full rounded-2xl border px-4 py-3 text-left",
                player?.player_tag === p.player_tag
                  ? "border-neutral-600 bg-neutral-900"
                  : "border-neutral-800 bg-neutral-950 hover:bg-neutral-900",
              ].join(" ")}
            >
              <div className="text-sm font-semibold">{p.player_name}</div>
              <div className="mt-1 text-xs text-neutral-400">{p.player_tag}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Decks */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Decks</div>
          {dLoading ? <div className="text-xs text-neutral-400">Loading...</div> : null}
        </div>

        {!player ? <div className="mt-3 text-sm text-neutral-400">Select a player to load decks.</div> : null}

        {dErr ? (
          <div className="mt-3">
            <ApiErrorPanel detail={dErr} />
          </div>
        ) : null}

        {!dLoading && player && dData && dData.decks.length === 0 ? (
          <div className="mt-3 text-sm text-neutral-400">No decks found.</div>
        ) : null}

        <div className="mt-3 space-y-2">
          {dData?.decks.map((d) => {
            const name = d.deck_name ?? "(no name)";
            const shortKey = d.my_deck_key.length > 40 ? d.my_deck_key.slice(0, 40) + "…" : d.my_deck_key;

            return (
              <button
                key={d.my_deck_key}
                onClick={() => setDeckKey(d.my_deck_key)}
                className={[
                  "w-full rounded-2xl border px-4 py-3 text-left",
                  deckKey === d.my_deck_key
                    ? "border-neutral-600 bg-neutral-900"
                    : "border-neutral-800 bg-neutral-950 hover:bg-neutral-900",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{name}</div>
                    <div className="mt-1 truncate text-xs text-neutral-400">{shortKey}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-neutral-500">battles</div>
                    <div className="text-sm font-semibold">{d.battles}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards refresh */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="text-sm font-medium">Cards</div>
        <div className="mt-2 flex items-center gap-2">
          <button
            disabled={cardsLoading}
            onClick={() => void refreshCards()}
            className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm hover:bg-neutral-900 disabled:opacity-60"
          >
            {cardsLoading ? "Refreshing..." : "Refresh cards (nocache=1)"}
          </button>
        </div>
        {cardsError ? (
          <div className="mt-3">
            <ApiErrorPanel title="Cards refresh error" detail={cardsError} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
