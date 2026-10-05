import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";

import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { NameField } from "@/features/tournaments/components/settings/name-field";
import { useUpdateTournament } from "@/features/tournaments/hooks/use-tournament-mutations";
import { useServerSeededState } from "@/hooks/use-server-seeded-state";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

export function NameSection({
  detail,
  locked,
}: {
  detail: TournamentDetailResponse;
  locked: boolean;
}) {
  const updateTournament = useUpdateTournament();
  const [name, setName] = useServerSeededState(detail.name);

  return (
    <SettingsSection
      id="name"
      title={m.tournaments_settings_name_title()}
      description={m.tournaments_settings_name_description()}
    >
      <div className="flex max-w-sm gap-2">
        <NameField id="t-rename" value={name} disabled={locked} onChange={setName} />
        <Button
          disabled={locked || !name.trim() || name.trim() === detail.name}
          pending={updateTournament.isPending}
          onClick={() =>
            void runReportedMutation(() =>
              updateTournament.mutateAsync({ id: detail.id, name: name.trim() }),
            )
          }
        >
          {m.common_save()}
        </Button>
      </div>
    </SettingsSection>
  );
}
