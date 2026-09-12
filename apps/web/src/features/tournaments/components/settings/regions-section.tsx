import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";

import { SettingsSection } from "@/components/layout/settings-section";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUpdateTournament } from "@/features/tournaments/hooks/use-tournament-mutations";
import { m } from "@/paraglide/messages.js";

export function RegionsSection({
  detail,
  locked,
}: {
  detail: TournamentDetailResponse;
  locked: boolean;
}) {
  const updateTournament = useUpdateTournament();

  async function toggle(checked: boolean) {
    try {
      await updateTournament.mutateAsync({ id: detail.id, regionsEnabled: checked });
    } catch {
      // Reported by the global mutation error toast (see reportMutationError).
    }
  }

  return (
    <SettingsSection
      id="regions"
      title={m.tournaments_settings_regions_title()}
      description={m.tournaments_settings_regions_description()}
    >
      <div className="flex items-center gap-3">
        <Switch
          id="t-regions"
          checked={detail.regionsEnabled}
          disabled={locked || updateTournament.isPending}
          onCheckedChange={(checked) => void toggle(checked)}
        />
        <Label htmlFor="t-regions">{m.tournaments_settings_regions_toggle()}</Label>
      </div>
    </SettingsSection>
  );
}
