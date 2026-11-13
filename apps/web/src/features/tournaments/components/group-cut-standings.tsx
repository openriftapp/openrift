import type { CutSize } from "@openrift/shared/pairing/group-cut-types";
import type {
  GroupStageView,
  LegendMetaShareView,
  PodStandingRow,
} from "@openrift/shared/types/api/pod-tournament";

import { Callout } from "@/components/ui/callout";
import { avatarsByPlayer } from "@/features/tournaments/lib/standings-display";
import { m } from "@/paraglide/messages.js";

import { CutSeedsCard, GroupStandingsCard, GroupTiebreakNote } from "./group-standings-cards";
import { LegendMetaSharesButton } from "./legend-meta-shares-dialog";

export function GroupCutStandings({
  groupStage,
  standings,
  cutSize,
  legendTiebreak,
  metaShares,
}: {
  groupStage: GroupStageView;
  standings: readonly PodStandingRow[];
  cutSize: CutSize;
  legendTiebreak: boolean;
  metaShares?: { id: string; shares: LegendMetaShareView[] };
}) {
  const avatars = avatarsByPlayer(standings);
  const needsShares = groupStage.pendingMetaShares.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {needsShares && metaShares ? (
        <Callout className="flex flex-wrap items-center justify-between gap-3">
          <span>
            {m.tournaments_cut_meta_shares_waiting({
              count: groupStage.pendingMetaShares.length,
            })}
          </span>
          <LegendMetaSharesButton
            id={metaShares.id}
            pending={groupStage.pendingMetaShares}
            shares={metaShares.shares}
          />
        </Callout>
      ) : null}
      {groupStage.groups.map((group) => (
        <GroupStandingsCard key={group.id} group={group} avatars={avatars} />
      ))}
      <CutSeedsCard
        groupStage={groupStage}
        cutSize={cutSize}
        legendTiebreak={legendTiebreak}
        avatars={avatars}
      />
      <GroupTiebreakNote legendTiebreak={legendTiebreak} />
    </div>
  );
}
