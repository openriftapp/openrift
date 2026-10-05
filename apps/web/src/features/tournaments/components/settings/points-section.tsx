import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";
import { toast } from "sonner";

import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import {
  parsePointsInput,
  PointsFields,
  pointsInputInvalid,
} from "@/features/tournaments/components/settings/points-fields";
import { useUpdateTournament } from "@/features/tournaments/hooks/use-tournament-mutations";
import { useServerSeededState } from "@/hooks/use-server-seeded-state";
import { m } from "@/paraglide/messages.js";

export function PointsSection({
  detail,
  locked,
}: {
  detail: TournamentDetailResponse;
  locked: boolean;
}) {
  const updateTournament = useUpdateTournament();
  const isSwiss = detail.pairingStyle === "swiss";
  const [winText, setWinText] = useServerSeededState(String(detail.winPoints));
  const [drawText, setDrawText] = useServerSeededState(String(detail.drawPoints));
  const [byeText, setByeText] = useServerSeededState(String(detail.byePoints));

  const value = { win: winText, draw: drawText, bye: byeText };
  const win = parsePointsInput(winText);
  const draw = parsePointsInput(drawText);
  const bye = parsePointsInput(byeText);
  const invalid = pointsInputInvalid(value, isSwiss);
  const changed =
    bye !== detail.byePoints ||
    (isSwiss && (win !== detail.winPoints || draw !== detail.drawPoints));

  async function save() {
    if (invalid) {
      return;
    }
    // Built before the try block: the React Compiler cannot lower conditional
    // value blocks inside try/catch and would bail out of this component.
    const patch = {
      id: detail.id,
      byePoints: bye ?? undefined,
      winPoints: isSwiss ? (win ?? undefined) : undefined,
      drawPoints: isSwiss ? (draw ?? undefined) : undefined,
    };
    try {
      await updateTournament.mutateAsync(patch);
      toast.success(m.tournaments_settings_points_updated());
    } catch {
      // Reported by the global mutation error toast (see reportMutationError).
    }
  }

  const description = isSwiss
    ? m.tournaments_settings_points_description_swiss()
    : m.tournaments_settings_points_description_bye();

  return (
    <SettingsSection
      id="points"
      title={m.tournaments_settings_points_title()}
      description={description}
    >
      <PointsFields
        value={value}
        swiss={isSwiss}
        disabled={locked}
        onChange={(patch) => {
          setWinText(patch.win ?? winText);
          setDrawText(patch.draw ?? drawText);
          setByeText(patch.bye ?? byeText);
        }}
        action={
          <Button
            disabled={locked || invalid || !changed}
            pending={updateTournament.isPending}
            onClick={() => void save()}
          >
            {m.common_save()}
          </Button>
        }
      />
    </SettingsSection>
  );
}
