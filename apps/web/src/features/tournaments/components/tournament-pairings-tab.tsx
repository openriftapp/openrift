import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";

import { PodPairingsSection } from "@/features/tournaments/components/pairings-section";
import { useTournamentRunState } from "@/features/tournaments/hooks/use-tournament-run";
import { isTournamentStaff } from "@/features/tournaments/lib/tournament-display";

export function TournamentPairingsTab({
  id,
  detail,
}: {
  id: string;
  detail: TournamentDetailResponse;
}) {
  const { data } = useTournamentRunState(id);
  return <PodPairingsSection id={id} data={data} staff={isTournamentStaff(detail.myRoles)} />;
}
