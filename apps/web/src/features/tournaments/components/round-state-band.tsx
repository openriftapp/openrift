import type { PodRoundResponse } from "@openrift/shared/types/api/pod-tournament";
import { SwordsIcon, TrophyIcon } from "lucide-react";

import { ActionBand } from "@/components/ui/action-band";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { pairingPluralNoun } from "@/features/tournaments/lib/tournament-display";
import { m } from "@/paraglide/messages.js";

function roundReportProgress(round: PodRoundResponse) {
  const total = round.pods.length;
  const reported = round.pods.filter((pod) => pod.resultStatus === "reported").length;
  return { total, reported, noun: pairingPluralNoun(round.pods.map((pod) => pod.size)) };
}

export function OpenRoundBand({
  round,
  suggested,
  finalizing,
  onFinalize,
}: {
  round: PodRoundResponse;
  suggested: number;
  finalizing: boolean;
  onFinalize: () => void;
}) {
  const { total, reported, noun } = roundReportProgress(round);
  const allReported = total > 0 && reported === total;
  const percent = total === 0 ? 0 : Math.round((reported / total) * 100);
  const progressLabel = m.tournaments_round_band_progress({ reported, total, noun });

  return (
    <ActionBand
      icon={SwordsIcon}
      accent={!allReported}
      label={m.tournaments_round_band_round({ number: round.roundNumber })}
      value={`${reported}/${total}`}
      sub={
        suggested > 0
          ? m.tournaments_round_band_sub_suggested({
              noun,
              number: round.roundNumber,
              suggested,
            })
          : m.tournaments_round_band_sub({ noun })
      }
      action={
        <span className="flex items-center gap-2">
          <Badge variant="warning">{m.tournaments_round_band_reporting()}</Badge>
          <Button size="sm" disabled={!allReported || finalizing} onClick={onFinalize}>
            {m.tournaments_round_band_finalize()}
          </Button>
        </span>
      }
    >
      <Progress value={percent} aria-label={progressLabel} />
    </ActionBand>
  );
}

export function CompletedRoundsBand({ finalizedCount }: { finalizedCount: number }) {
  return (
    <ActionBand
      icon={TrophyIcon}
      label={m.tournaments_round_band_over()}
      value={finalizedCount}
      sub={
        finalizedCount === 1
          ? m.tournaments_round_band_over_sub_one()
          : m.tournaments_round_band_over_sub_other()
      }
      action={<Badge variant="secondary">{m.tournaments_round_band_read_only()}</Badge>}
    />
  );
}
