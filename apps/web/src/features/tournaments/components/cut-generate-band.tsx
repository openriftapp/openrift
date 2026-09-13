import type { CutSize } from "@openrift/shared/pairing/group-cut-types";
import type {
  GroupStageView,
  LegendMetaShareView,
} from "@openrift/shared/types/api/pod-tournament";
import { TrophyIcon } from "lucide-react";
import { useState } from "react";

import { ActionBand } from "@/components/ui/action-band";
import { Button } from "@/components/ui/button";
import { useGenerateTournamentRound } from "@/features/tournaments/hooks/use-tournament-run";
import { cutRoundGenerateLabel, cutRoundLabel } from "@/features/tournaments/lib/group-cut-display";
import { groupUnits, waitingUnitsLabel } from "@/features/tournaments/lib/group-cut-units";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

import { LegendMetaSharesDialog } from "./legend-meta-shares-dialog";

export function NextCutRoundBand({
  id,
  cutSize,
  nextRoundNumber,
}: {
  id: string;
  cutSize: CutSize;
  nextRoundNumber: number;
}) {
  const generateRound = useGenerateTournamentRound();
  const label = cutRoundLabel(cutSize, nextRoundNumber);
  return (
    <ActionBand
      icon={TrophyIcon}
      accent
      label={m.tournaments_cut_band_bracket()}
      value={label}
      valueClassName="font-sans text-base font-medium"
      sub={m.tournaments_cut_band_bracket_sub()}
      action={
        <Button
          disabled={generateRound.isPending}
          onClick={() => void runReportedMutation(() => generateRound.mutateAsync({ id }))}
        >
          {cutRoundGenerateLabel(cutSize, nextRoundNumber)}
        </Button>
      }
    />
  );
}

export function CutGenerateBand({
  id,
  cutSize,
  groupStage,
  shares,
  staff,
}: {
  id: string;
  cutSize: CutSize;
  groupStage: GroupStageView;
  shares: LegendMetaShareView[];
  staff: boolean;
}) {
  const generateRound = useGenerateTournamentRound();
  const [sharesOpen, setSharesOpen] = useState(false);

  const waiting = waitingUnitsLabel(groupUnits(groupStage.groups));
  const needsShares = groupStage.pendingMetaShares.length > 0;
  const blocked = waiting !== null || needsShares;

  return (
    <>
      <ActionBand
        icon={TrophyIcon}
        accent={!blocked}
        label={m.tournaments_cut_band_top_cut()}
        value={cutSize}
        sub={
          waiting
            ? m.tournaments_cut_band_waiting_for({ units: waiting })
            : m.tournaments_cut_band_seeded_sub()
        }
        action={
          <span className="flex items-center gap-2">
            {needsShares && staff ? (
              <Button variant="outline" onClick={() => setSharesOpen(true)}>
                {m.tournaments_cut_enter_meta_shares()}
              </Button>
            ) : null}
            <Button
              disabled={blocked || generateRound.isPending}
              onClick={() => void runReportedMutation(() => generateRound.mutateAsync({ id }))}
            >
              {m.tournaments_cut_generate_top({ size: cutSize })}
            </Button>
          </span>
        }
      >
        {needsShares ? (
          <p className="text-muted-foreground text-sm">
            {m.tournaments_cut_meta_shares_needed({ count: groupStage.pendingMetaShares.length })}
          </p>
        ) : null}
      </ActionBand>
      {staff ? (
        <LegendMetaSharesDialog
          id={id}
          pending={groupStage.pendingMetaShares}
          shares={shares}
          open={sharesOpen}
          onOpenChange={setSharesOpen}
        />
      ) : null}
    </>
  );
}
