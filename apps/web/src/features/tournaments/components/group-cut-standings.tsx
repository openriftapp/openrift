import type { CutSize } from "@openrift/shared/pairing/group-cut-types";
import type {
  GroupStageView,
  LegendMetaShareView,
} from "@openrift/shared/types/api/pod-tournament";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { m } from "@/paraglide/messages.js";

import { CutSeedsCard, GroupStandingsCard, GroupTiebreakNote } from "./group-standings-cards";
import { LegendMetaSharesDialog } from "./legend-meta-shares-dialog";

export function GroupCutStandings({
  groupStage,
  cutSize,
  legendTiebreak,
  metaShares,
}: {
  groupStage: GroupStageView;
  cutSize: CutSize;
  legendTiebreak: boolean;
  /** Staff only: enables the meta-share dialog for the pending Legends. */
  metaShares?: { id: string; shares: LegendMetaShareView[] };
}) {
  const [sharesOpen, setSharesOpen] = useState(false);
  const needsShares = groupStage.pendingMetaShares.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {needsShares && metaShares ? (
        <Callout className="flex flex-wrap items-center justify-between gap-3">
          <span>
            {groupStage.pendingMetaShares.length === 1
              ? m.tournaments_cut_meta_shares_waiting_one({
                  count: groupStage.pendingMetaShares.length,
                })
              : m.tournaments_cut_meta_shares_waiting_other({
                  count: groupStage.pendingMetaShares.length,
                })}
          </span>
          <Button variant="outline" onClick={() => setSharesOpen(true)}>
            {m.tournaments_cut_enter_meta_shares()}
          </Button>
        </Callout>
      ) : null}
      {groupStage.groups.map((group) => (
        <GroupStandingsCard key={group.id} group={group} />
      ))}
      <CutSeedsCard groupStage={groupStage} cutSize={cutSize} />
      <GroupTiebreakNote legendTiebreak={legendTiebreak} />
      {metaShares ? (
        <LegendMetaSharesDialog
          id={metaShares.id}
          pending={groupStage.pendingMetaShares}
          shares={metaShares.shares}
          open={sharesOpen}
          onOpenChange={setSharesOpen}
        />
      ) : null}
    </div>
  );
}
