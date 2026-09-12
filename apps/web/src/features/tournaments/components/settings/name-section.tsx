import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";

import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateTournament } from "@/features/tournaments/hooks/use-tournament-mutations";
import { useServerSeededState } from "@/hooks/use-server-seeded-state";
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

  async function save() {
    try {
      await updateTournament.mutateAsync({ id: detail.id, name: name.trim() });
    } catch {
      // Reported by the global mutation error toast (see reportMutationError).
    }
  }

  return (
    <SettingsSection
      id="name"
      title={m.tournaments_settings_name_title()}
      description={m.tournaments_settings_name_description()}
    >
      <div className="flex max-w-sm gap-2">
        <Input
          id="t-rename"
          value={name}
          maxLength={120}
          disabled={locked}
          aria-label={m.tournaments_settings_name_aria()}
          onChange={(event) => setName(event.target.value)}
        />
        <Button
          disabled={
            locked || !name.trim() || name.trim() === detail.name || updateTournament.isPending
          }
          onClick={() => void save()}
        >
          {m.common_save()}
        </Button>
      </div>
    </SettingsSection>
  );
}
