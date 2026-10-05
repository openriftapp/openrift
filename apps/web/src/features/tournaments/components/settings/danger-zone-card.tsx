import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";
import { useNavigate } from "@tanstack/react-router";

import { ConfirmActionButton } from "@/components/confirm-action-dialog";
import { DangerZone } from "@/components/layout/danger-zone";
import { Button } from "@/components/ui/button";
import {
  useCancelTournament,
  useDeleteTournament,
} from "@/features/tournaments/hooks/use-tournament-mutations";
import { m } from "@/paraglide/messages.js";

export function DangerZoneCard({ detail }: { detail: TournamentDetailResponse }) {
  const navigate = useNavigate();
  const cancelTournament = useCancelTournament();
  const deleteTournament = useDeleteTournament();

  return (
    <DangerZone
      title={m.tournaments_settings_danger_zone_title()}
      description={m.tournaments_settings_danger_zone_description()}
    >
      {detail.status === "cancelled" ? null : (
        <ConfirmActionButton
          trigger={<Button variant="secondary" />}
          title={m.tournaments_settings_cancel_confirm_title({ name: detail.name })}
          description={m.tournaments_settings_cancel_confirm_description()}
          confirmLabel={m.tournaments_settings_cancel_tournament()}
          cancelLabel={m.tournaments_settings_keep_it()}
          onConfirm={() => cancelTournament.mutateAsync({ id: detail.id })}
        >
          {m.tournaments_settings_cancel_tournament()}
        </ConfirmActionButton>
      )}
      <ConfirmActionButton
        trigger={<Button variant="destructive" />}
        title={m.tournaments_settings_delete_confirm_title({ name: detail.name })}
        description={m.tournaments_settings_delete_confirm_description()}
        confirmLabel={m.common_delete()}
        onConfirm={async () => {
          await deleteTournament.mutateAsync(detail.id);
          await navigate({ to: "/tournaments" });
        }}
      >
        {m.tournaments_settings_delete_tournament()}
      </ConfirmActionButton>
    </DangerZone>
  );
}
