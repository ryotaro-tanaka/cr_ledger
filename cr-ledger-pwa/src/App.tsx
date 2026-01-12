import { useEffect, useMemo, useState } from "react";
import {
  AuthError,
  ApiError,
  sync,
  getMyDecks,
  getMatchupByCard,
  getPriority,
  getOpponentTrendLast,
  getOpponentTrendSince,
} from "./api/api";
import type { SlotKind } from "./api/types";
import { ErrorBanner } from "./components/ErrorBanner";
import { LoadingInline } from "./components/LoadingInline";
import { Table, Td, Th } from "./components/Table";
import { int, num, pct, shortKey } from "./lib/format";
import { loadState, saveState } from "./lib/storage";
import { useCardMaster } from "./cards/useCardMaster";

type UiError =
  | { kind: "none" }
  | { kind: "auth"; message: string; detail?: string }
  | { kind: "api"; message: string; status?: number; detail?: string }
  | { kind: "unknown"; message: string; detail?: string };

function toUiError(e: unknown): UiError {
  if (e instanceof AuthError) return { kind: "auth", message: e.message };
  if (e instanceof ApiError) return { kind: "api", message: e.message, status: e.status, detail: e.bodyText };
  if (e instanceof Error) return { kind: "unknown", message: e.message };
  return { kind: "unknown", message: "Unknown error" };
}

function CardCell(props: {
  id: number;
  kind: SlotKind;
  master: { getName(id: number): string | null; getIconUrl(id: number, kind: SlotKind): string | null } | null;
}) {
  const name = props.master?.getName(props.id) ?? null;
  const url = props.master?.getIconUrl(props.id, props.kind) ?? null;

  return (
    <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      {url ? (
        <img
          src={url}
          alt={name ?? String(props.id)}
          width={28}
          height={28}
          style={{ borderRadius: 6, display: "block" }}
          loading="lazy"
        />
      ) : (
        <div style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #ddd" }} />
      )}
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>{name ?? "(unknown)"}</span>
        <span style={{ fontSize: 12, opacity: 0.75 }}>{props.id}</span>
      </div>
    </div>
  );
}

export default function App() {
  // persisted UI state
  const persisted = useMemo(() => loadState(), []);
  const [selectedDeckKey, setSelectedDeckKey] = useState<string>(persisted.selectedDeckKey ?? "");

  const [trendMode, setTrendMode] = useState<"last" | "since">(persisted.trendMode ?? "last");
  const [trendLast, setTrendLast] = useState<number>(persisted.trendLast ?? 200);
  const [trendSince, setTrendSince] = useState<string>(persisted.trendSince ?? "20260101T000000.000Z");

  const [deckLast, setDeckLast] = useState<number>(persisted.deckLast ?? 500);
  const [deckMin, setDeckMin] = useState<number>(persisted.deckMin ?? 5);

  const [decisionMemo, setDecisionMemo] = useState<string>(
    (persisted.decisionMemoByDeck ?? {})[persisted.selectedDeckKey ?? ""] ?? ""
  );

  // card master (RoyaleAPI proxy)
  const { master: cardMaster, loading: cardMasterLoading, error: cardMasterError } = useCardMaster();

  // data
  const [syncing, setSyncing] = useState(false);
  const [syncOk, setSyncOk] = useState<boolean | null>(null);
  const [syncDebug, setSyncDebug] = useState<unknown | null>(null);

  const [myDecksLoading, setMyDecksLoading] = useState(false);
  const [myDecks, setMyDecks] = useState<
    Array<{ my_deck_key: string; deck_name: string | null; battles: number }>
  >([]);

  const [deckLoading, setDeckLoading] = useState(false);
  const [matchupCards, setMatchupCards] = useState<
    Array<{ card_id: number; slot_kind: SlotKind; battles: number; wins: number; losses: number; win_rate: number }>
  >([]);
  const [priorityCards, setPriorityCards] = useState<
    Array<{
      card_id: number;
      slot_kind: SlotKind;
      battles_with_card: number;
      usage_rate: number;
      win_rate: number;
      priority_score: number;
    }>
  >([]);

  const [trendLoading, setTrendLoading] = useState(false);
  const [trendCards, setTrendCards] = useState<Array<{ card_id: number; slot_kind: SlotKind; battles: number; usage_rate: number }>>(
    []
  );
  const [trendTotalBattles, setTrendTotalBattles] = useState<number>(0);

  const [err, setErr] = useState<UiError>({ kind: "none" });

  // persist some ui state
  useEffect(() => {
    saveState({ selectedDeckKey, trendMode, trendLast, trendSince, deckLast, deckMin });
  }, [selectedDeckKey, trendMode, trendLast, trendSince, deckLast, deckMin]);

  // persist memo by deck
  useEffect(() => {
    const st = loadState();
    const map = { ...(st.decisionMemoByDeck ?? {}) };
    if (selectedDeckKey) map[selectedDeckKey] = decisionMemo;
    saveState({ decisionMemoByDeck: map });
  }, [selectedDeckKey, decisionMemo]);

  // load decks at start
  useEffect(() => {
    void (async () => {
      setErr({ kind: "none" });
      setMyDecksLoading(true);
      try {
        const res = await getMyDecks(200);
        const decks = res.decks ?? [];
        setMyDecks(decks);

        // auto select
        if (!selectedDeckKey && decks.length > 0) {
          const first = decks[0].my_deck_key;
          setSelectedDeckKey(first);

          const st = loadState();
          const memo = (st.decisionMemoByDeck ?? {})[first] ?? "";
          setDecisionMemo(memo);
        }
      } catch (e) {
        setErr(toUiError(e));
      } finally {
        setMyDecksLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // load deck detail whenever selection / params change
  useEffect(() => {
    if (!selectedDeckKey) return;

    void (async () => {
      setErr({ kind: "none" });
      setDeckLoading(true);
      try {
        const [m, p] = await Promise.all([
          getMatchupByCard({ myDeckKey: selectedDeckKey, last: deckLast, min: deckMin }),
          getPriority({ myDeckKey: selectedDeckKey, last: deckLast, min: deckMin }),
        ]);

        const matchup = (m.cards ?? []).slice().sort((a, b) => a.win_rate - b.win_rate); // 苦手が上
        const priority = (p.cards ?? []).slice().sort((a, b) => b.priority_score - a.priority_score); // 対策優先が上

        setMatchupCards(matchup);
        setPriorityCards(priority);

        // memo load on deck switch
        const st = loadState();
        const memo = (st.decisionMemoByDeck ?? {})[selectedDeckKey] ?? "";
        setDecisionMemo(memo);
      } catch (e) {
        setErr(toUiError(e));
        setMatchupCards([]);
        setPriorityCards([]);
      } finally {
        setDeckLoading(false);
      }
    })();
  }, [selectedDeckKey, deckLast, deckMin]);

  // load trend
  useEffect(() => {
    void (async () => {
      setErr({ kind: "none" });
      setTrendLoading(true);
      try {
        const res =
          trendMode === "last"
            ? await getOpponentTrendLast(trendLast)
            : await getOpponentTrendSince(trendSince);

        const cards = (res.cards ?? []).slice().sort((a, b) => b.usage_rate - a.usage_rate);
        setTrendCards(cards);
        setTrendTotalBattles(res.total_battles ?? 0);
      } catch (e) {
        setErr(toUiError(e));
        setTrendCards([]);
        setTrendTotalBattles(0);
      } finally {
        setTrendLoading(false);
      }
    })();
  }, [trendMode, trendLast, trendSince]);

  const authHint =
    err.kind === "auth"
      ? "401: 認証キーが違う or 未設定です。VITE_CR_LEDGER_AUTH を確認してください。"
      : null;

  const selectedDeck = myDecks.find((d) => d.my_deck_key === selectedDeckKey) ?? null;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: "8px 0 4px" }}>CR Ledger PWA</h1>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Card master:{" "}
          {cardMasterLoading ? (
            "loading..."
          ) : cardMasterError ? (
            <span title={cardMasterError} style={{ color: "#b00020" }}>
              failed
            </span>
          ) : (
            "ok"
          )}
        </div>
      </div>

      {err.kind !== "none" ? (
        <div style={{ marginTop: 12 }}>
          <ErrorBanner
            title={
              err.kind === "auth"
                ? "Authentication Error"
                : err.kind === "api"
                ? `API Error${err.status ? ` (${err.status})` : ""}`
                : "Error"
            }
            detail={authHint ?? err.detail ?? err.message}
          />
        </div>
      ) : null}

      {/* Sync */}
      <section style={{ marginTop: 16, padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={async () => {
              setErr({ kind: "none" });
              setSyncing(true);
              setSyncOk(null);
              setSyncDebug(null);
              try {
                const res = await sync();
                setSyncOk(Boolean(res.ok));
                // クライアントでは ok だけ使う想定だけど、デバッグ用に表示できるよう保持
                setSyncDebug(res);
              } catch (e) {
                setErr(toUiError(e));
              } finally {
                setSyncing(false);
              }
            }}
            disabled={syncing}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              cursor: syncing ? "default" : "pointer",
              background: "white",
            }}
          >
            {syncing ? "Syncing..." : "Sync now"}
          </button>

          {syncing ? <LoadingInline label="Fetching & upserting..." /> : null}

          {syncOk !== null ? (
            <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.85 }}>
              Result: {syncOk ? "OK" : "NG"}
            </span>
          ) : null}
        </div>

        {syncDebug ? (
          <pre style={{ marginTop: 12, background: "#fafafa", padding: 12, borderRadius: 10, overflowX: "auto" }}>
            {JSON.stringify(syncDebug, null, 2)}
          </pre>
        ) : null}
      </section>

      {/* Main layout */}
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16, marginTop: 16 }}>
        {/* My Decks */}
        <section style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
            <h2 style={{ margin: "0 0 10px" }}>My Decks (recent)</h2>
            {myDecksLoading ? <LoadingInline label="Loading" /> : null}
          </div>

          {!myDecksLoading && myDecks.length === 0 ? (
            <div style={{ opacity: 0.8 }}>No decks found. Try “Sync now”.</div>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {myDecks.map((d) => {
              const active = d.my_deck_key === selectedDeckKey;
              return (
                <button
                  key={d.my_deck_key}
                  onClick={() => setSelectedDeckKey(d.my_deck_key)}
                  style={{
                    textAlign: "left",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: active ? "#f5f5f5" : "white",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{d.deck_name ?? "(no name)"}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    <span title={d.my_deck_key}>{shortKey(d.my_deck_key)}</span>
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>battles: {int(d.battles)}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Deck detail */}
        <section style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
          <h2 style={{ margin: "0 0 10px" }}>Deck Detail</h2>

          {!selectedDeckKey ? (
            <div style={{ opacity: 0.8 }}>Select a deck from left.</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  deck:{" "}
                  <code title={selectedDeckKey}>
                    {selectedDeck?.deck_name ? `${selectedDeck.deck_name} / ` : ""}
                    {shortKey(selectedDeckKey, 28)}
                  </code>
                </div>

                <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  last
                  <input
                    type="number"
                    value={deckLast}
                    min={1}
                    onChange={(e) => setDeckLast(Number(e.target.value))}
                    style={{ width: 110, padding: 6, borderRadius: 8, border: "1px solid #ddd" }}
                  />
                </label>

                <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  min
                  <select
                    value={deckMin}
                    onChange={(e) => setDeckMin(Number(e.target.value))}
                    style={{ padding: 6, borderRadius: 8, border: "1px solid #ddd" }}
                  >
                    {[1, 2, 3, 5, 8, 10].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>

                {deckLoading ? <LoadingInline label="Loading" /> : null}
              </div>

              {/* Matchup */}
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                  <h3 style={{ margin: "0 0 8px" }}>Matchup by card</h3>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    sort: win_rate asc (苦手が上)
                  </div>
                </div>

                {matchupCards.length === 0 && !deckLoading ? (
                  <div style={{ opacity: 0.8 }}>
                    No rows. If you set <b>min</b> too high, try lowering it.
                  </div>
                ) : null}

                <Table>
                  <thead>
                    <tr>
                      <Th>card</Th>
                      <Th>slot_kind</Th>
                      <Th>battles</Th>
                      <Th>win_rate</Th>
                      <Th>wins</Th>
                      <Th>losses</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchupCards.map((r, idx) => (
                      <tr key={`${r.card_id}-${r.slot_kind}-${idx}`}>
                        <Td>
                          <CardCell id={r.card_id} kind={r.slot_kind} master={cardMaster} />
                        </Td>
                        <Td>{r.slot_kind}</Td>
                        <Td>{int(r.battles)}</Td>
                        <Td>{pct(r.win_rate)}</Td>
                        <Td>{int(r.wins)}</Td>
                        <Td>{int(r.losses)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {/* Priority */}
              <div style={{ marginTop: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                  <h3 style={{ margin: "0 0 8px" }}>Priority</h3>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    sort: priority_score desc (対策優先が上)
                  </div>
                </div>

                {priorityCards.length === 0 && !deckLoading ? (
                  <div style={{ opacity: 0.8 }}>
                    No rows. If you set <b>min</b> too high, try lowering it.
                  </div>
                ) : null}

                <Table>
                  <thead>
                    <tr>
                      <Th>card</Th>
                      <Th>slot_kind</Th>
                      <Th>battles_with_card</Th>
                      <Th>usage_rate</Th>
                      <Th>win_rate</Th>
                      <Th>priority_score</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {priorityCards.map((r, idx) => (
                      <tr key={`${r.card_id}-${r.slot_kind}-${idx}`}>
                        <Td>
                          <CardCell id={r.card_id} kind={r.slot_kind} master={cardMaster} />
                        </Td>
                        <Td>{r.slot_kind}</Td>
                        <Td>{int(r.battles_with_card)}</Td>
                        <Td>{pct(r.usage_rate)}</Td>
                        <Td>{pct(r.win_rate)}</Td>
                        <Td>{num(r.priority_score, 3)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {/* Memo */}
              {/* <div style={{ marginTop: 18 }}>
                <h3 style={{ margin: "0 0 8px" }}>意思決定メモ（ローカル保存）</h3>
                <textarea
                  value={decisionMemo}
                  onChange={(e) => setDecisionMemo(e.target.value)}
                  rows={6}
                  placeholder="上位N枚を見て、次に練習する対策などを書いておく…"
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    fontFamily: "inherit",
                  }}
                />
              </div> */}
            </>
          )}
        </section>
      </div>

      {/* Opponent trend */}
      <section style={{ marginTop: 16, padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
          <h2 style={{ margin: "0 0 10px" }}>Opponent Trend</h2>
          {trendLoading ? <LoadingInline label="Loading" /> : null}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input type="radio" checked={trendMode === "last"} onChange={() => setTrendMode("last")} />
            last
          </label>
          <input
            type="number"
            value={trendLast}
            min={1}
            disabled={trendMode !== "last"}
            onChange={(e) => setTrendLast(Number(e.target.value))}
            style={{ width: 120, padding: 6, borderRadius: 8, border: "1px solid #ddd" }}
          />

          <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input type="radio" checked={trendMode === "since"} onChange={() => setTrendMode("since")} />
            since
          </label>
          <input
            type="text"
            value={trendSince}
            disabled={trendMode !== "since"}
            onChange={(e) => setTrendSince(e.target.value)}
            placeholder="20260101T000000.000Z"
            style={{ width: 280, padding: 6, borderRadius: 8, border: "1px solid #ddd" }}
          />

          <div style={{ fontSize: 12, opacity: 0.75 }}>
            total_battles: {int(trendTotalBattles)}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          {trendCards.length === 0 && !trendLoading ? <div style={{ opacity: 0.8 }}>No trend rows.</div> : null}

          <Table>
            <thead>
              <tr>
                <Th>card</Th>
                <Th>slot_kind</Th>
                <Th>usage_rate</Th>
                <Th>battles</Th>
              </tr>
            </thead>
            <tbody>
              {trendCards.map((r, idx) => (
                <tr key={`${r.card_id}-${r.slot_kind}-${idx}`}>
                  <Td>
                    <CardCell id={r.card_id} kind={r.slot_kind} master={cardMaster} />
                  </Td>
                  <Td>{r.slot_kind}</Td>
                  <Td>{pct(r.usage_rate)}</Td>
                  <Td>{int(r.battles)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        {cardMasterError ? (
          <div style={{ marginTop: 10, fontSize: 12, color: "#b00020" }}>
            Card master fetch failed (RoyaleAPI proxy). Showing fallback IDs only may be incomplete: {cardMasterError}
          </div>
        ) : null}
      </section>

      <footer style={{ marginTop: 18, opacity: 0.7, fontSize: 12 }}>
        Note: CR_LEDGER_AUTH は Git にコミットしない（.env を gitignore）。
      </footer>
    </div>
  );
}
