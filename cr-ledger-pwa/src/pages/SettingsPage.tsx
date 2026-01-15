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

function cx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
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
    const short = deckKey.length > 48 ? deckKey.slice(0, 48) + "…" : deckKey;
    return short;
  }, [deckKey]);

  const hint = !player ? "Select a player first." : !deckKey ? "Select a deck." : "Ready.";

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-[22px] border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
      {children}
    </div>
  );

  return (
    <section className="mx-auto max-w-md space-y-4 px-4 pt-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">Settings</h1>
          <div className="mt-1 text-xs text-slate-500">{hint}</div>
        </div>
        <div className="text-[11px] text-slate-500">standalone: {String(standalone)}</div>
      </div>

      {/* Install guide (only when not standalone) */}
      {!standalone ? (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">{installHint.title}</div>
              <div className="mt-1 text-xs text-slate-600">
                Install to remove the URL bar and use the app like a native screen.
              </div>
            </div>
            <div className="shrink-0 rounded-full bg-blue-600/10 px-2 py-1 text-[11px] font-semibold text-blue-700">
              PWA
            </div>
          </div>

          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-800">
            {installHint.steps.map((s, i) => (
              <li key={i} className="leading-6">
                {s}
              </li>
            ))}
          </ol>

          {/* emphasis (iPhone toggle) */}
          <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-slate-800">
            <span className="font-semibold text-blue-800">iPhone note:</span>{" "}
            When adding to Home Screen, make sure <span className="font-semibold">“Open as Web App”</span>{" "}
            is enabled — otherwise the URL bar may remain visible.
          </div>

          <div className="mt-3 text-xs text-slate-600">Note: {installHint.note}</div>
        </Card>
      ) : null}

      {/* Selected */}
      <Card>
        <div className="text-sm font-semibold text-slate-900">Selected</div>

        <div className="mt-3 grid gap-3">
          <div>
            <div className="text-xs text-slate-500">Player</div>
            <div className="mt-1 text-sm text-slate-900">
              {player ? `${player.player_name} (${player.player_tag})` : "(none)"}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Deck</div>
            <div className="mt-1 break-all text-sm text-slate-900">{selectedDeckLabel}</div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => nav("/", { replace: true })}
            className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-[0.99]"
          >
            Go Home
          </button>
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
      </Card>

      {/* Players */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Players</div>
          {pLoading ? <div className="text-xs text-slate-500">Loading...</div> : null}
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

      {/* Decks */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Decks</div>
          {dLoading ? <div className="text-xs text-slate-500">Loading...</div> : null}
        </div>

        {!player ? (
          <div className="mt-3 text-sm text-slate-600">Select a player to load decks.</div>
        ) : null}

        {dErr ? (
          <div className="mt-3">
            <ApiErrorPanel detail={dErr} />
          </div>
        ) : null}

        {!dLoading && player && dData && dData.decks.length === 0 ? (
          <div className="mt-3 text-sm text-slate-600">No decks found.</div>
        ) : null}

        <div className="mt-3 space-y-2">
          {dData?.decks.map((d) => {
            const name = d.deck_name ?? "(no name)";
            const shortKey = d.my_deck_key.length > 48 ? d.my_deck_key.slice(0, 48) + "…" : d.my_deck_key;

            return (
              <button
                key={d.my_deck_key}
                onClick={() => setDeckKey(d.my_deck_key)}
                className={cx(
                  "w-full rounded-2xl border px-4 py-3 text-left shadow-sm transition",
                  deckKey === d.my_deck_key
                    ? "border-blue-200 bg-blue-50"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{name}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">{shortKey}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500">battles</div>
                    <div className="text-sm font-semibold text-slate-900">{d.battles}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Cards refresh */}
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Cards</div>
            <div className="mt-1 text-xs text-slate-600">Refresh cards cache when names/icons look outdated.</div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            disabled={cardsLoading}
            onClick={() => void refreshCards()}
            className={cx(
              "rounded-xl px-3 py-2 text-sm font-semibold shadow-sm transition active:scale-[0.99]",
              cardsLoading ? "bg-slate-200 text-slate-500" : "bg-blue-600 text-white hover:bg-blue-700"
            )}
          >
            {cardsLoading ? "Refreshing..." : "Refresh cards (nocache=1)"}
          </button>
        </div>

        {cardsError ? (
          <div className="mt-3">
            <ApiErrorPanel title="Cards refresh error" detail={cardsError} />
          </div>
        ) : null}
      </Card>

      {/* spacer for bottom nav */}
      <div style={{ height: "calc(92px + var(--safe-bottom))" }} />
    </section>
  );
}
