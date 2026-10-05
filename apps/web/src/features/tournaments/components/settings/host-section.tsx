import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";
import { toast } from "sonner";

import { SettingsSection } from "@/components/layout/settings-section";
import { HostField } from "@/features/tournaments/components/settings/host-field";
import { useUpdateTournament } from "@/features/tournaments/hooks/use-tournament-mutations";
import { m } from "@/paraglide/messages.js";

export function HostSection({
  detail,
  locked,
}: {
  detail: TournamentDetailResponse;
  locked: boolean;
}) {
  const updateTournament = useUpdateTournament();
  const currentValue = detail.host.type === "user" ? "user" : (detail.host.orgId ?? "user");

  async function changeHost(value: string) {
    const host =
      value === "user"
        ? ({ type: "user" } as const)
        : ({ type: "organization", orgId: value } as const);
    try {
      await updateTournament.mutateAsync({ id: detail.id, host });
      toast.success(m.tournaments_settings_host_updated());
    } catch {
      // Reported by the global mutation error toast (see reportMutationError).
    }
  }

  return (
    <SettingsSection
      id="host"
      title={m.tournaments_settings_host_title()}
      description={m.tournaments_settings_host_description()}
    >
      <HostField
        value={currentValue}
        disabled={locked || updateTournament.isPending}
        className="max-w-sm"
        onChange={(value) => void changeHost(value)}
      />
    </SettingsSection>
  );
}
