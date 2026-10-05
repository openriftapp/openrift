import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";

import { SettingsSection } from "@/components/layout/settings-section";
import { SwitchField } from "@/features/tournaments/components/settings/switch-field";
import { useUpdateTournament } from "@/features/tournaments/hooks/use-tournament-mutations";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

export function RegionsSection({
  detail,
  locked,
}: {
  detail: TournamentDetailResponse;
  locked: boolean;
}) {
  const updateTournament = useUpdateTournament();

  return (
    <SettingsSection
      id="regions"
      title={m.tournaments_settings_regions_title()}
      description={m.tournaments_settings_regions_description()}
    >
      <SwitchField
        id="t-regions"
        label={m.tournaments_settings_regions_toggle()}
        checked={detail.regionsEnabled}
        disabled={locked || updateTournament.isPending}
        onCheckedChange={(checked) =>
          void runReportedMutation(() =>
            updateTournament.mutateAsync({ id: detail.id, regionsEnabled: checked }),
          )
        }
      />
    </SettingsSection>
  );
}
