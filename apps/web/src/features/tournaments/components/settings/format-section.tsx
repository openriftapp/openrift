import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";

import { SettingsSection } from "@/components/layout/settings-section";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { GroupCutSettingsFields } from "@/features/tournaments/components/group-cut-settings-fields";
import { useUpdateTournament } from "@/features/tournaments/hooks/use-tournament-mutations";
import type { TournamentRoundsChoice } from "@/features/tournaments/lib/tournament-display";
import {
  hasPairing,
  isGroupCutChoice,
  MATCH_FORMAT_LABEL,
  pairingStyleLabels,
  PLAY_MODE_ITEMS,
  pairingFromRoundsChoice,
  roundsChoiceItems,
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
  const roundsItems = roundsChoiceItems().filter(
    (item) => detail.playMode !== "2v2" || (item.value !== "pod" && !isGroupCutChoice(item.value)),
  );
  const playModeItems = groupCut
    ? PLAY_MODE_ITEMS.filter((item) => item.value === "1v1")
    : PLAY_MODE_ITEMS;
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
          <div className="flex flex-col gap-1.5">
            <Label>{m.tournaments_settings_play_mode_label()}</Label>
            <Select
              items={playModeItems}
              value={detail.playMode}
              disabled={locked || updateTournament.isPending}
              onValueChange={(value) => {
                if (value === "1v1" || value === "2v2") {
                  void runReportedMutation(() =>
                    updateTournament.mutateAsync({
                      id: detail.id,
                      playMode: value,
                      pairingStyle:
                        value === "2v2" && detail.pairingStyle === "pod" ? "swiss" : undefined,
                      regionsEnabled: value === "2v2" && detail.regionsEnabled ? false : undefined,
                    }),
                  );
                }
              }}
            >
              <SelectTrigger aria-label={m.tournaments_settings_play_mode_label()}>
                <SelectValue placeholder={m.tournaments_settings_play_mode_label()} />
              </SelectTrigger>
              <SelectContent>
                {playModeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
            <div className="flex flex-col gap-1.5">
              <Label>{m.tournaments_settings_rounds_label()}</Label>
              <Select
                items={roundsItems}
                value={roundsChoice}
                disabled={locked || updateTournament.isPending}
                onValueChange={(value) => {
                  if (!value || value === roundsChoice) {
                    return;
                  }
                  const next = pairingFromRoundsChoice(value as TournamentRoundsChoice);
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
              >
                <SelectTrigger aria-label={m.tournaments_settings_rounds_label()}>
                  <SelectValue placeholder={m.tournaments_settings_rounds_label()} />
                </SelectTrigger>
                <SelectContent>
                  {roundsItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
