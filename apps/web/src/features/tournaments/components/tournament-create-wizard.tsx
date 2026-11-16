import type {
  TournamentDeckSubmission,
  TournamentListLockMode,
} from "@openrift/shared/types/api/tournament";
import { WellKnown } from "@openrift/shared/well-known";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { SettingsGroup } from "@/components/layout/settings-group";
import { SettingsSection } from "@/components/layout/settings-section";
import { TopBarBreadcrumbBar } from "@/components/layout/top-bar-breadcrumb";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useFriendGroups } from "@/features/groups/hooks/use-friend-groups";
import type { GroupCutSettings } from "@/features/tournaments/components/group-cut-settings-fields";
import { GroupCutSettingsFields } from "@/features/tournaments/components/group-cut-settings-fields";
import { SaveError } from "@/features/tournaments/components/save-error";
import {
  AllowDeckEditsField,
  DeckDeadlineField,
  DeckFormatField,
  DeckSubmissionField,
} from "@/features/tournaments/components/settings/decks-fields";
import {
  PlayModeField,
  RoundsField,
} from "@/features/tournaments/components/settings/format-fields";
import { GroupField } from "@/features/tournaments/components/settings/group-field";
import { HostField } from "@/features/tournaments/components/settings/host-field";
import { NameField } from "@/features/tournaments/components/settings/name-field";
import type { PointsInput } from "@/features/tournaments/components/settings/points-fields";
import {
  parsePointsInput,
  PointsFields,
  pointsInputInvalid,
} from "@/features/tournaments/components/settings/points-fields";
import type { ScheduleInput } from "@/features/tournaments/components/settings/schedule-fields";
import { ScheduleFields } from "@/features/tournaments/components/settings/schedule-fields";
import { SwitchField } from "@/features/tournaments/components/settings/switch-field";
import { useCreateTournament } from "@/features/tournaments/hooks/use-tournament-mutations";
import type {
  TournamentFormatState,
  TournamentRoundsChoice,
} from "@/features/tournaments/lib/tournament-display";
import {
  applyFormatChange,
  hasPairing,
  parseDeadlineInput,
  parseScheduleInput,
  regionsAvailable,
  restorePairings,
  roundsChoiceFor,
} from "@/features/tournaments/lib/tournament-display";
import { localTimeZoneLabel, splitUtcToLocalDateTime } from "@/lib/date-time-input";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function TournamentCreateWizard({ defaultGroupId }: { defaultGroupId?: string }) {
  const navigate = useNavigate();
  const createTournament = useCreateTournament();
  const { data: groupsData } = useFriendGroups();

  // Falls back to "none" for an unknown group id so it never reaches the
  // `z.uuid()` create contract as a group id.
  const initialGroupId =
    defaultGroupId && groupsData.items.some((group) => group.id === defaultGroupId)
      ? defaultGroupId
      : "none";
  const hasInitialGroup = initialGroupId !== "none";

  const [name, setName] = useState("");
  const [hostValue, setHostValue] = useState("user");
  const [formatState, setFormatState] = useState<TournamentFormatState>({
    playMode: "1v1",
    pairingStyle: "pod",
    matchFormat: "bo1",
    format: "rounds",
    regionsEnabled: false,
  });
  const [lastRoundsChoice, setLastRoundsChoice] = useState<TournamentRoundsChoice | null>(null);
  const [points, setPoints] = useState<PointsInput>({ win: "3", draw: "1", bye: "3" });
  const [groupCut, setGroupCut] = useState<GroupCutSettings>({
    cutSize: 8,
    groupsSelfPaced: true,
    cutRematchAvoidance: false,
    legendTiebreak: false,
  });
  const [deckSubmission, setDeckSubmission] = useState<TournamentDeckSubmission>(
    hasInitialGroup ? "required" : "none",
  );
  const [selfRegistration, setSelfRegistration] = useState(false);
  const [groupId, setGroupId] = useState(initialGroupId);
  // Reads the viewer's clock, which only works because the route is `ssr: "data-only"`.
  const [schedule, setSchedule] = useState<ScheduleInput>(() => {
    const nowLocal = splitUtcToLocalDateTime(new Date().toISOString());
    return { startDate: nowLocal.date, startTime: nowLocal.time, endDate: "", endTime: "" };
  });
  const [closeDate, setCloseDate] = useState("");
  const [closeTime, setCloseTime] = useState("");
  const [lockMode, setLockMode] = useState<TournamentListLockMode>("at_deadline");
  const [deckFormat, setDeckFormat] = useState<string>(WellKnown.deckFormat.CONSTRUCTED);

  const wantsDeck = deckSubmission !== "none";
  const { playMode, pairingStyle, matchFormat, format, regionsEnabled } = formatState;
  const runsRounds = hasPairing(pairingStyle);
  const roundsChoice = roundsChoiceFor(pairingStyle, matchFormat, format);
  const isSwiss = pairingStyle === "swiss";
  const isGroupCut = format === "group_cut";
  const isTeams = playMode === "2v2";
  const showRegions = regionsAvailable(formatState);
  const winPoints = parsePointsInput(points.win);
  const drawPoints = parsePointsInput(points.draw);
  const byePoints = parsePointsInput(points.bye);
  const pointsInvalid = runsRounds && pointsInputInvalid(points, isSwiss);
  const deadline = parseDeadlineInput(closeDate, closeTime, null);
  const submissionsCloseAt = wantsDeck ? deadline.closeAt : null;
  const closeTimeInvalid = wantsDeck && deadline.incomplete;
  // Start + end parsing and validation, shared with the settings tab so the two
  // surfaces stay in step.
  const { startsAt, endsAt, scheduleInvalid } = parseScheduleInput(
    schedule.startDate,
    schedule.startTime,
    schedule.endDate,
    schedule.endTime,
  );

  async function handleCreate() {
    if (!name.trim() || !startsAt || closeTimeInvalid || scheduleInvalid || pointsInvalid) {
      return;
    }
    const host =
      hostValue === "user"
        ? ({ type: "user" } as const)
        : ({ type: "organization", orgId: hostValue } as const);
    const linkedGroupId = groupId === "none" ? null : groupId;
    const listLockMode = wantsDeck ? lockMode : undefined;
    const payload = {
      name: name.trim(),
      host,
      pairingStyle,
      playMode,
      format: runsRounds ? format : undefined,
      cutSize: isGroupCut ? groupCut.cutSize : undefined,
      groupsSelfPaced: isGroupCut ? groupCut.groupsSelfPaced : undefined,
      cutRematchAvoidance: isGroupCut ? groupCut.cutRematchAvoidance : undefined,
      legendTiebreak: isGroupCut ? groupCut.legendTiebreak : undefined,
      matchFormat: isSwiss ? matchFormat : undefined,
      winPoints: isSwiss ? (winPoints ?? undefined) : undefined,
      drawPoints: isSwiss ? (drawPoints ?? undefined) : undefined,
      byePoints: runsRounds ? (byePoints ?? undefined) : undefined,
      regionsEnabled: showRegions ? regionsEnabled : undefined,
      startsAt,
      endsAt,
      deckSubmission,
      selfRegistration,
      groupId: linkedGroupId,
      submissionsCloseAt,
      listLockMode,
      deckFormat: wantsDeck ? deckFormat : undefined,
    };
    let created: Awaited<ReturnType<typeof createTournament.mutateAsync>> | undefined;
    const ok = await runReportedMutation(async () => {
      created = await createTournament.mutateAsync(payload);
    });
    if (ok && created) {
      void navigate({ to: "/tournaments/$id", params: { id: created.id } });
    }
  }

  return (
    <TopBarBreadcrumbBar
      segments={[{ label: m.nav_tournaments(), link: <Link to="/tournaments" /> }]}
      title={m.tournaments_list_new()}
    >
      <div className={cn(PAGE_WIDTH.capped, "flex flex-col gap-6 pt-3", PAGE_PADDING_NO_TOP)}>
        <SettingsGroup id="general" title={m.tournaments_settings_toc_general()}>
          <SettingsSection title={m.common_name()}>
            <NameField id="t-name" value={name} className="max-w-sm" onChange={setName} />
          </SettingsSection>

          <SettingsSection
            title={m.tournaments_lib_viewer_role_host()}
            description={m.tournaments_new_host_description()}
            contentClassName="grid gap-x-6 gap-y-3 sm:grid-cols-2"
          >
            <div className="flex flex-col gap-1.5">
              <Label>{m.tournaments_lib_viewer_role_host()}</Label>
              <HostField value={hostValue} onChange={setHostValue} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{m.tournaments_new_group_label()}</Label>
              <GroupField value={groupId} onChange={setGroupId} />
            </div>
          </SettingsSection>

          <SettingsSection
            title={m.tournaments_settings_toc_schedule()}
            description={m.tournaments_new_schedule_description({
              timezone: localTimeZoneLabel(),
            })}
          >
            <ScheduleFields
              value={schedule}
              onChange={(patch) => setSchedule((current) => ({ ...current, ...patch }))}
            />
          </SettingsSection>
        </SettingsGroup>

        <SettingsGroup id="pairings-decks" title={m.tournaments_settings_toc_pairings_decks()}>
          <SettingsSection
            title={m.tournaments_settings_toc_format()}
            description={m.tournaments_new_format_description()}
            contentClassName="grid gap-x-6 gap-y-3 sm:grid-cols-2"
          >
            <PlayModeField
              value={playMode}
              groupCut={isGroupCut}
              onChange={(value) =>
                setFormatState((current) => applyFormatChange(current, { playMode: value }))
              }
            />
          </SettingsSection>

          <SettingsSection
            title={m.tournaments_section_pairings()}
            description={m.tournaments_new_pairings_description()}
          >
            <SwitchField
              id="t-pairings"
              label={m.tournaments_new_pairings_enable()}
              checked={runsRounds}
              onCheckedChange={(pairingsEnabled) => {
                if (pairingsEnabled) {
                  setFormatState((current) => restorePairings(current, lastRoundsChoice));
                  return;
                }
                setLastRoundsChoice(roundsChoice);
                setFormatState((current) => applyFormatChange(current, { pairingsEnabled }));
              }}
            />
            {roundsChoice ? (
              <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <RoundsField
                  value={roundsChoice}
                  teams={isTeams}
                  onChange={(value) =>
                    setFormatState((current) => applyFormatChange(current, { roundsChoice: value }))
                  }
                />
                <PointsFields
                  value={points}
                  swiss={isSwiss}
                  onChange={(patch) => setPoints((current) => ({ ...current, ...patch }))}
                />
              </div>
            ) : null}
            {isGroupCut ? (
              <GroupCutSettingsFields
                idPrefix="t-new"
                value={groupCut}
                onChange={(patch) => setGroupCut((current) => ({ ...current, ...patch }))}
              />
            ) : null}
          </SettingsSection>

          <SettingsSection
            title={m.tournaments_section_decks()}
            description={m.tournaments_new_decks_description()}
          >
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <DeckSubmissionField value={deckSubmission} onChange={setDeckSubmission} />
              {wantsDeck ? (
                <DeckDeadlineField
                  date={closeDate}
                  time={closeTime}
                  error={closeTimeInvalid ? m.tournaments_new_datetime_error() : undefined}
                  onDateChange={setCloseDate}
                  onTimeChange={setCloseTime}
                />
              ) : null}
            </div>
            {wantsDeck ? (
              <>
                <DeckFormatField value={deckFormat} className="max-w-sm" onChange={setDeckFormat} />
                <AllowDeckEditsField value={lockMode} onChange={setLockMode} />
              </>
            ) : null}
          </SettingsSection>
        </SettingsGroup>

        {showRegions ? (
          <SettingsGroup id="custom" title={m.tournaments_new_custom_group()}>
            <SettingsSection
              title={m.tournaments_region_overview_heading()}
              description={m.tournaments_new_regions_description()}
            >
              <SwitchField
                id="t-regions"
                label={m.tournaments_settings_regions_toggle()}
                checked={regionsEnabled}
                onCheckedChange={(checked) =>
                  setFormatState((current) => ({ ...current, regionsEnabled: checked }))
                }
              />
            </SettingsSection>
          </SettingsGroup>
        ) : null}

        <SettingsGroup id="registration" title={m.tournaments_new_registration_group()}>
          <SettingsSection
            title={m.tournaments_new_self_registration_title()}
            description={m.tournaments_new_self_registration_description()}
          >
            <SwitchField
              id="t-self-reg"
              label={m.tournaments_settings_self_registration()}
              checked={selfRegistration}
              onCheckedChange={setSelfRegistration}
            />
          </SettingsSection>
        </SettingsGroup>

        <SaveError error={createTournament.error} />
        <div className="flex items-center gap-2">
          <Button
            onClick={() => void handleCreate()}
            disabled={!name.trim() || closeTimeInvalid || scheduleInvalid || pointsInvalid}
            pending={createTournament.isPending}
          >
            {m.tournaments_new_create()}
          </Button>
          <Link to="/tournaments" className={buttonVariants({ variant: "ghost" })}>
            {m.common_cancel()}
          </Link>
        </div>
      </div>
    </TopBarBreadcrumbBar>
  );
}
