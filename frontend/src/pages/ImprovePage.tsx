import { useMemo, useState } from "react";
import ApiErrorPanel from "../components/ApiErrorPanel";
import SectionCard from "../components/SectionCard";
import { useCardMaster } from "../cards/useCardMaster";
import { useSelection } from "../lib/selection";
import { useCommonPlayers } from "../lib/commonPlayers";
import { ActionSection, IssueSection, WhySection } from "./improve/ImproveSections";
import { useImproveInsights, type WhyTab } from "./improve/useImproveInsights";

export default function ImprovePage() {
  const { player, deckKey } = useSelection();
  const { master } = useCardMaster();
  const { data: playersData } = useCommonPlayers();
  const [whyTab, setWhyTab] = useState<WhyTab>("attack");
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);

  const {
    loading,
    err,
    attackIssue,
    defenseIssue,
    priorityIssue,
    offenseCompare,
    defenseBars,
    actions,
    trendTopWinCons,
  } = useImproveInsights({ player, deckKey, master });

  const selectedAction = useMemo(() => actions.find((a) => a.id === selectedActionId) ?? null, [actions, selectedActionId]);


  const playerLabel = useMemo(() => {
    if (!player) return "(not selected)";
    const selectedPlayer = playersData?.players.find((p) => p.player_tag === player.player_tag);
    const selectedDeck = selectedPlayer?.decks.find((d) => d.my_deck_key === deckKey);
    const deckName = selectedDeck?.deck_name?.trim() ? selectedDeck.deck_name : "No Name";
    return `${player.player_name} (${player.player_tag}) - ${deckName}`;
  }, [deckKey, player, playersData]);

  return (
    <section className="mx-auto max-w-md space-y-4 px-4 pt-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">Improve</h1>
        <div className="mt-1 text-xs text-slate-500">{playerLabel}</div>
      </div>

      {err ? <ApiErrorPanel detail={err} /> : null}
      {loading ? (
        <SectionCard>
          <div className="text-sm text-slate-500">Loading improve insights...</div>
        </SectionCard>
      ) : null}

      {!loading && !err ? (
        <>
          <IssueSection attackIssue={attackIssue} defenseIssue={defenseIssue} priorityIssue={priorityIssue} master={master} />
          <WhySection
            whyTab={whyTab}
            setWhyTab={setWhyTab}
            offenseCompare={offenseCompare}
            defenseBars={defenseBars}
            trendTopWinCons={trendTopWinCons}
            master={master}
          />
          <ActionSection
            actions={actions}
            selectedActionId={selectedActionId}
            selectedAction={selectedAction}
            setSelectedActionId={setSelectedActionId}
          />
        </>
      ) : null}
    </section>
  );
}
