import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";
import { toast } from "sonner";

import { SettingsSection } from "@/components/layout/settings-section";
import { GroupField } from "@/features/tournaments/components/settings/group-field";
import { useUpdateTournament } from "@/features/tournaments/hooks/use-tournament-mutations";
import { m } from "@/paraglide/messages.js";

export function GroupSection({
  detail,
  locked,
}: {
  detail: TournamentDetailResponse;
  locked: boolean;
}) {
  const updateTournament = useUpdateTournament();

  async function changeGroup(value: string) {
    const groupId = value === "none" ? null : value;
    const successMessage =
      value === "none"
        ? m.tournaments_settings_group_unlinked_toast()
        : m.tournaments_settings_group_updated_toast();
    try {
      await updateTournament.mutateAsync({ id: detail.id, groupId });
      toast.success(successMessage);
    } catch {
      // Errors surface via the global mutation error toast.
    }
  }

  return (
    <SettingsSection
      id="group"
      title={m.tournaments_settings_group_title()}
      description={m.tournaments_settings_group_description()}
    >
      <GroupField
        value={detail.groupId ?? "none"}
        linkedGroupName={detail.groupName}
        disabled={locked || updateTournament.isPending}
        className="max-w-sm"
        onChange={(value) => void changeGroup(value)}
      />
    </SettingsSection>
  );
}
