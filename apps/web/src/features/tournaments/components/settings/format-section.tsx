import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";

import { SettingsSection } from "@/components/layout/settings-section";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { GroupCutSettingsFields } from "@/features/tournaments/components/group-cut-settings-fields";
import {
  PlayModeField,
  RoundsField,
} from "@/features/tournaments/components/settings/format-fields";
import { useUpdateTournament } from "@/features/tournaments/hooks/use-tournament-mutations";
import {
  hasPairing,
  MATCH_FORMAT_LABEL,
  pairingStyleLabels,
  pairingFromRoundsChoice,
  roundsChoiceFor,
} from "@/features/tournaments/lib/tournament-display";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

export function FormatSection({
  detail,
  locked,
}: {
  detail: TournamentDetailResponse;
  locked: boolean;
}) {
  const updateTournament = useUpdateTournament();
  const runsRounds = hasPairing(detail.pairingStyle);
  const isSwiss = detail.pairingStyle === "swiss";
  const groupCut = detail.format === "group_cut";
  const roundsChoice = roundsChoiceFor(detail.pairingStyle, detail.matchFormat, detail.format);
  const description = detail.hasRounds
    ? m.tournaments_settings_format_description_rounds({
        teams: detail.playMode === "2v2" ? m.tournaments_settings_format_teams_prefix() : "",
        style: pairingStyleLabels()[detail.pairingStyle],
      })
    : m.tournaments_settings_format_description_locked();

  return (
    <SettingsSection
      id="pairings"
      title={m.tournaments_settings_format_title()}
      description={description}
    >
      {detail.hasRounds ? (
        groupCut ? (
          <p className="text-muted-foreground text-sm">
            {m.tournaments_settings_format_group_cut_note({
              format: MATCH_FORMAT_LABEL[detail.matchFormat],
              size: detail.cutSize,
            })}
          </p>
        ) : isSwiss ? (
          <p className="text-muted-foreground text-sm">
            {m.tournaments_settings_format_swiss_note({
              format: MATCH_FORMAT_LABEL[detail.matchFormat],
            })}
          </p>
        ) : null
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-3">
          <PlayModeField
            value={detail.playMode}
            groupCut={groupCut}
            disabled={locked || updateTournament.isPending}
            onChange={(playMode) =>
              void runReportedMutation(() =>
                updateTournament.mutateAsync({
                  id: detail.id,
                  playMode,
                  pairingStyle:
                    playMode === "2v2" && detail.pairingStyle === "pod" ? "swiss" : undefined,
                  regionsEnabled: playMode === "2v2" && detail.regionsEnabled ? false : undefined,
                }),
              )
            }
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-pairings-enabled">{m.tournaments_settings_pairings_label()}</Label>
            <div className="flex h-8 items-center">
              <Switch
                id="t-pairings-enabled"
                checked={runsRounds}
                disabled={locked || updateTournament.isPending}
                onCheckedChange={(checked) => {
                  void runReportedMutation(() =>
                    updateTournament.mutateAsync({
                      id: detail.id,
                      pairingStyle: checked
                        ? detail.playMode === "2v2"
                          ? "swiss"
                          : "pod"
                        : "none",
                    }),
                  );
                }}
              />
            </div>
          </div>
          {roundsChoice ? (
            <RoundsField
              value={roundsChoice}
              teams={detail.playMode === "2v2"}
              disabled={locked || updateTournament.isPending}
              onChange={(choice) => {
                const next = pairingFromRoundsChoice(choice);
                void runReportedMutation(() =>
                  updateTournament.mutateAsync({
                    id: detail.id,
                    pairingStyle: next.pairingStyle,
                    matchFormat: next.pairingStyle === "swiss" ? next.matchFormat : undefined,
                    format: next.format,
                    playMode: next.format === "group_cut" ? "1v1" : undefined,
                  }),
                );
              }}
            />
          ) : null}
          {groupCut ? (
            <div className="basis-full">
              <GroupCutSettingsFields
                idPrefix="t-settings"
                disabled={locked || updateTournament.isPending}
                value={{
                  cutSize: detail.cutSize,
                  groupsSelfPaced: detail.groupsSelfPaced,
                  cutRematchAvoidance: detail.cutRematchAvoidance,
                  legendTiebreak: detail.legendTiebreak,
                }}
                onChange={(patch) => {
                  void runReportedMutation(() =>
                    updateTournament.mutateAsync({ id: detail.id, ...patch }),
                  );
                }}
              />
            </div>
          ) : null}
        </div>
      )}
    </SettingsSection>
  );
}
