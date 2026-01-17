import { useNavigate } from "react-router-dom";
import { useSelection } from "../lib/selection";
import ApiErrorPanel from "../components/ApiErrorPanel";
import SyncCard from "./home/SyncCard";
import PreviewCard from "./home/PreviewCard";
import { getPriority, getMatchupByCard, getOpponentTrendLast } from "../api/api";
import type {
  PriorityResponse,
  MatchupByCardResponse,
  OpponentTrendResponse,
} from "../api/types";
import { toThumbs } from "./home/thumbs";
import { useCardMaster } from "../cards/useCardMaster";

export default function HomePage() {
  const nav = useNavigate();
  const { player, deckKey } = useSelection();
  const { error: cardsError } = useCardMaster();

  const last = 500;
  const playerLabel = player
    ? `${player.player_name} (${player.player_tag})`
    : "(not selected)";

  return (
    <section className="mx-auto max-w-md space-y-4 px-4 pt-4">
      {/* Header */}
      <div className="space-y-1">
        <div className="text-[22px] font-semibold tracking-tight text-slate-900">
          Home
        </div>
        <div className="text-xs text-slate-500">{playerLabel}</div>

        {!player || !deckKey ? (
          <div className="mt-2 rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-700 shadow-sm">
            Setup is required. Please select{" "}
            <span className="font-semibold">Player</span> and{" "}
            <span className="font-semibold">Deck</span> in Settings.
            <div className="mt-2">
              <button
                onClick={() => nav("/settings")}
                className="inline-flex items-center rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                Open Settings →
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {cardsError ? (
        <ApiErrorPanel title="Cards error" detail={cardsError} />
      ) : null}

      <SyncCard />

      <PreviewCard<PriorityResponse>
        title="Priority"
        openTo="/priority"
        last={last}
        needsDeck
        noDeckText="Select a deck in Settings to see Priority."
        emptyText="No priority data."
        load={() => getPriority(player!.player_tag, deckKey!, last)}
        toThumbs={(d) =>
          toThumbs(d.cards, (c) => ({
            card_id: c.card_id,
            slot_kind: c.slot_kind,
          }))
        }
      />

      <PreviewCard<MatchupByCardResponse>
        title="Matchup"
        openTo="/matchup"
        last={last}
        needsDeck
        noDeckText="Select a deck in Settings to see Matchup."
        emptyText="No matchup data."
        load={() => getMatchupByCard(player!.player_tag, deckKey!, last)}
        toThumbs={(d) =>
          toThumbs(d.cards, (c) => ({
            card_id: c.card_id,
            slot_kind: c.slot_kind,
          }))
        }
      />

      <PreviewCard<OpponentTrendResponse>
        title="Trend"
        openTo="/trend"
        last={last}
        emptyText="No trend data."
        load={() => getOpponentTrendLast(player!.player_tag, last)}
        toThumbs={(d) =>
          toThumbs(d.cards, (c) => ({
            card_id: c.card_id,
            slot_kind: c.slot_kind,
          }))
        }
      />
    </section>
  );
}
