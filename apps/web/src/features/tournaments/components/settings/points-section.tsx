import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";
import { toast } from "sonner";

import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  const parsePoints = (text: string): number | null => {
    if (!/^\d{1,2}$/u.test(text.trim())) {
      return null;
    }
    return Number(text.trim());
  };
  const win = parsePoints(winText);
  const draw = parsePoints(drawText);
  const bye = parsePoints(byeText);
  const invalid = bye === null || (isSwiss && (win === null || draw === null));
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
      <div className="flex flex-wrap items-end gap-3">
        {isSwiss ? (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-win-points">{m.tournaments_settings_points_win()}</Label>
              <Input
                id="t-win-points"
                value={winText}
                disabled={locked}
                inputMode="numeric"
                className="w-20 tabular-nums"
                aria-label={m.tournaments_settings_points_win_aria()}
                onChange={(event) => setWinText(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-draw-points">{m.tournaments_settings_points_draw()}</Label>
              <Input
                id="t-draw-points"
                value={drawText}
                disabled={locked}
                inputMode="numeric"
                className="w-20 tabular-nums"
                aria-label={m.tournaments_settings_points_draw_aria()}
                onChange={(event) => setDrawText(event.target.value)}
              />
            </div>
          </>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="t-bye-points">{m.tournaments_settings_points_bye()}</Label>
          <Input
            id="t-bye-points"
            value={byeText}
            disabled={locked}
            inputMode="numeric"
            className="w-20 tabular-nums"
            aria-label={m.tournaments_settings_points_bye_aria()}
            onChange={(event) => setByeText(event.target.value)}
          />
        </div>
        <Button
          disabled={locked || invalid || !changed || updateTournament.isPending}
          onClick={() => void save()}
        >
          {m.common_save()}
        </Button>
      </div>
      {invalid ? <FieldError>{m.tournaments_settings_points_invalid()}</FieldError> : null}
    </SettingsSection>
  );
}
