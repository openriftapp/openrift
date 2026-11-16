import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";
import { toast } from "sonner";

import { SettingsSection } from "@/components/layout/settings-section";
import { SaveError } from "@/features/tournaments/components/save-error";
import { GroupField } from "@/features/tournaments/components/settings/group-field";
import { SwitchField } from "@/features/tournaments/components/settings/switch-field";
import { useUpdateTournament } from "@/features/tournaments/hooks/use-tournament-mutations";
import { runReportedMutation } from "@/lib/run-reported-mutation";
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
    if (await runReportedMutation(() => updateTournament.mutateAsync({ id: detail.id, groupId }))) {
      toast.success(successMessage);
    }
  }

  async function changePublished(published: boolean) {
    const successMessage = published
      ? m.tournaments_settings_group_published_toast()
      : m.tournaments_settings_group_unpublished_toast();
    if (
      await runReportedMutation(() => updateTournament.mutateAsync({ id: detail.id, published }))
    ) {
      toast.success(successMessage);
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
      {detail.groupId ? (
        <SwitchField
          id="t-published"
          label={m.tournaments_settings_group_published_label()}
          hint={m.tournaments_settings_group_published_hint()}
          checked={detail.published}
          disabled={locked || updateTournament.isPending}
          onCheckedChange={(checked) => void changePublished(checked)}
        />
      ) : null}
      <SaveError error={updateTournament.error} />
    </SettingsSection>
  );
}
