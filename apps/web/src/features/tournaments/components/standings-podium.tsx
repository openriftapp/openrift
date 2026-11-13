import type { PodStandingRow } from "@openrift/shared/types/api/pod-tournament";
import type { TournamentPlayMode } from "@openrift/shared/types/api/tournament";

import { Podium } from "@/components/ui/podium";
import { podiumSeats } from "@/features/tournaments/components/podium-seats";
import { collapseTeamStandings } from "@/features/tournaments/lib/team-display";
import { m } from "@/paraglide/messages.js";

export function StandingsPodium({
  standings,
  variant = "pod",
  playMode = "1v1",
}: {
  standings: PodStandingRow[];
  variant?: "pod" | "swiss";
  playMode?: TournamentPlayMode;
}) {
  const rows = playMode === "2v2" ? collapseTeamStandings(standings) : standings;
  return (
    <Podium
      seats={podiumSeats(rows, variant === "swiss")}
      emptyLabel={m.tournaments_standings_podium_empty()}
    />
  );
}
