import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";

import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateTournament } from "@/features/tournaments/hooks/use-tournament-mutations";
import { useServerSeededState } from "@/hooks/use-server-seeded-state";

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
    <SettingsSection id="name" title="Name" description="The tournament's display name.">
      <div className="flex max-w-sm gap-2">
        <Input
          id="t-rename"
          value={name}
          maxLength={120}
          disabled={locked}
          aria-label="Tournament name"
          onChange={(event) => setName(event.target.value)}
        />
        <Button
          disabled={
            locked || !name.trim() || name.trim() === detail.name || updateTournament.isPending
          }
          onClick={() => void save()}
        >
          Save
        </Button>
      </div>
    </SettingsSection>
  );
}
