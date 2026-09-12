import type {
  TournamentDeckSubmission,
  TournamentPlayMode,
} from "@openrift/shared/types/api/tournament";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { PageTopBar, PageTopBarSticky, PageTopBarTitle } from "@/components/layout/page-top-bar";
import { SettingsGroup } from "@/components/layout/settings-group";
import { SettingsSection } from "@/components/layout/settings-section";
import {
  TopBarBreadcrumbSeparator,
  TopBarBreadcrumbTrail,
} from "@/components/layout/top-bar-breadcrumb";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useFriendGroups } from "@/features/groups/hooks/use-friend-groups";
import type { GroupCutSettings } from "@/features/tournaments/components/group-cut-settings-fields";
import { GroupCutSettingsFields } from "@/features/tournaments/components/group-cut-settings-fields";
import { useMyOrganizations } from "@/features/tournaments/hooks/use-organizations";
import { useCreateTournament } from "@/features/tournaments/hooks/use-tournament-mutations";
import type { TournamentRoundsChoice } from "@/features/tournaments/lib/tournament-display";
import {
  combineLocalDateTimeToUtc,
  deckSubmissionItems,
  hasPairing,
  isGroupCutChoice,
  localTimeZoneLabel,
  pairingFromRoundsChoice,
  parseScheduleInput,
  PLAY_MODE_ITEMS,
  roundsChoiceItems,
  splitUtcToLocalDateTime,
} from "@/features/tournaments/lib/tournament-display";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function TournamentCreateWizard({ defaultGroupId }: { defaultGroupId?: string }) {
  const navigate = useNavigate();
  const createTournament = useCreateTournament();
  const { data: orgsData } = useMyOrganizations();
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
  const [pairingsEnabled, setPairingsEnabled] = useState(true);
  const [roundsChoice, setRoundsChoice] = useState<TournamentRoundsChoice>("pod");
  const [playMode, setPlayMode] = useState<TournamentPlayMode>("1v1");
  const [winPointsText, setWinPointsText] = useState("3");
  const [drawPointsText, setDrawPointsText] = useState("1");
  const [byePointsText, setByePointsText] = useState("3");
  const [regionsEnabled, setRegionsEnabled] = useState(false);
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
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [closeTime, setCloseTime] = useState("");
  const [lockMode, setLockMode] = useState<"on_submit" | "at_deadline">("at_deadline");

  // Prefill the start to the current local time, once, on the first hydrated
  // render — reading the clock during the SSR pass would mismatch the client's.
  const hydrated = useHydrated();
  const [startPrefilled, setStartPrefilled] = useState(false);
  if (hydrated && !startPrefilled) {
    const nowLocal = splitUtcToLocalDateTime(new Date().toISOString());
    setStartPrefilled(true);
    setStartDate(nowLocal.date);
    setStartTime(nowLocal.time);
  }

  const hostItems = [
    { value: "user", label: m.tournaments_new_host_personal() },
    ...orgsData.items.map((org) => ({ value: org.id, label: org.name })),
  ];
  const groupItems = [
    { value: "none", label: m.tournaments_new_group_none() },
    ...groupsData.items.map((group) => ({ value: group.id, label: group.name })),
  ];

  const tzLabel = localTimeZoneLabel();
  const deckItems = deckSubmissionItems();
  const wantsDeck = deckSubmission !== "none";
  const { pairingStyle, matchFormat, format } = pairingsEnabled
    ? pairingFromRoundsChoice(roundsChoice)
    : { pairingStyle: "none" as const, matchFormat: "bo1" as const, format: "rounds" as const };
  const runsRounds = hasPairing(pairingStyle);
  const isSwiss = pairingStyle === "swiss";
  const isGroupCut = format === "group_cut";
  const isTeams = playMode === "2v2";
  // 2v2 pairs team Swiss: free-for-all pods don't compose with fixed teams,
  // and the region layer isn't team-aware yet.
  const roundsItems = roundsChoiceItems().filter(
    (item) => !isTeams || (item.value !== "pod" && !isGroupCutChoice(item.value)),
  );
  const playModeItems = isGroupCut
    ? PLAY_MODE_ITEMS.filter((item) => item.value === "1v1")
    : PLAY_MODE_ITEMS;

  function handlePlayModeChange(value: TournamentPlayMode) {
    setPlayMode(value);
    if (value === "2v2" && (roundsChoice === "pod" || isGroupCutChoice(roundsChoice))) {
      setRoundsChoice("swiss-bo1");
    }
  }

  function handleRoundsChoiceChange(value: TournamentRoundsChoice) {
    setRoundsChoice(value);
    if (isGroupCutChoice(value)) {
      setPlayMode("1v1");
      setRegionsEnabled(false);
    }
  }
  const parsePoints = (text: string): number | null => {
    if (!/^\d{1,2}$/u.test(text.trim())) {
      return null;
    }
    return Number(text.trim());
  };
  const winPoints = parsePoints(winPointsText);
  const drawPoints = parsePoints(drawPointsText);
  const byePoints = parsePoints(byePointsText);
  const pointsInvalid =
    runsRounds && (byePoints === null || (isSwiss && (winPoints === null || drawPoints === null)));
  const submissionsCloseAt = wantsDeck ? combineLocalDateTimeToUtc(closeDate, closeTime) : null;
  const closeTimeInvalid =
    wantsDeck && (closeDate !== "" || closeTime !== "") && submissionsCloseAt === null;
  // Start + end parsing and validation, shared with the settings tab so the two
  // surfaces stay in step.
  const { startsAt, endsAt, startInvalid, endIncomplete, endBeforeStart, scheduleInvalid } =
    parseScheduleInput(startDate, startTime, endDate, endTime);

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
    // Must be built before the try block: the React Compiler bails out of
    // conditional value blocks inside try/catch.
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
      regionsEnabled: runsRounds && !isTeams ? regionsEnabled : undefined,
      startsAt,
      endsAt,
      deckSubmission,
      selfRegistration,
      groupId: linkedGroupId,
      submissionsCloseAt,
      listLockMode,
    };
    try {
      const created = await createTournament.mutateAsync(payload);
      void navigate({ to: "/tournaments/$id", params: { id: created.id } });
    } catch {
      // Errors surface via the global mutation error toast.
    }
  }

  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar className="gap-2">
          <TopBarBreadcrumbTrail
            segments={[{ label: m.nav_tournaments(), link: <Link to="/tournaments" /> }]}
          />
          <TopBarBreadcrumbSeparator className="hidden sm:inline" />
          <PageTopBarTitle>{m.tournaments_list_new()}</PageTopBarTitle>
        </PageTopBar>
      </PageTopBarSticky>
      <div className={cn(PAGE_WIDTH.capped, "flex flex-col gap-6 pt-3", PAGE_PADDING_NO_TOP)}>
        <SettingsGroup id="general" title={m.tournaments_settings_toc_general()}>
          <SettingsSection title={m.common_name()}>
            <Input
              id="t-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              className="max-w-sm"
              aria-label={m.tournaments_new_name_aria()}
              placeholder="Summoner Skirmish"
            />
          </SettingsSection>

          <SettingsSection
            title={m.tournaments_lib_viewer_role_host()}
            description={m.tournaments_new_host_description()}
            contentClassName="grid gap-x-6 gap-y-3 sm:grid-cols-2"
          >
            <div className="flex flex-col gap-1.5">
              <Label>{m.tournaments_lib_viewer_role_host()}</Label>
              <Select
                items={hostItems}
                value={hostValue}
                onValueChange={(value) => value && setHostValue(value)}
              >
                <SelectTrigger className="w-full" aria-label={m.tournaments_lib_viewer_role_host()}>
                  <SelectValue placeholder={m.tournaments_new_host_placeholder()} />
                </SelectTrigger>
                <SelectContent>
                  {hostItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{m.tournaments_new_group_label()}</Label>
              <Select
                items={groupItems}
                value={groupId}
                onValueChange={(value) => value && setGroupId(value)}
              >
                <SelectTrigger className="w-full" aria-label={m.tournaments_settings_toc_group()}>
                  <SelectValue placeholder={m.tournaments_new_group_none()} />
                </SelectTrigger>
                <SelectContent>
                  {groupItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </SettingsSection>

          <SettingsSection
            title={m.tournaments_settings_toc_schedule()}
            description={m.tournaments_new_schedule_description({ timezone: tzLabel })}
            contentClassName="grid gap-x-6 gap-y-3 sm:grid-cols-2"
          >
            <div className="flex flex-col gap-1.5">
              <Label>{m.tournaments_new_starts_label()}</Label>
              <div className="flex flex-wrap items-center gap-2">
                <DatePicker
                  value={startDate}
                  onChange={setStartDate}
                  onClear={() => setStartDate("")}
                  className="w-44"
                />
                <Input
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  placeholder="HH:mm"
                  aria-label={m.tournaments_new_start_time_aria()}
                  className="w-24 tabular-nums"
                />
              </div>
              {startInvalid ? <FieldError>{m.tournaments_new_datetime_error()}</FieldError> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{m.tournaments_new_ends_label()}</Label>
              <div className="flex flex-wrap items-center gap-2">
                <DatePicker
                  value={endDate}
                  onChange={setEndDate}
                  onClear={() => setEndDate("")}
                  className="w-44"
                />
                <Input
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  placeholder="HH:mm"
                  aria-label={m.tournaments_new_end_time_aria()}
                  className="w-24 tabular-nums"
                />
              </div>
              {endIncomplete ? (
                <FieldError>{m.tournaments_new_end_incomplete_error()}</FieldError>
              ) : endBeforeStart ? (
                <FieldError>{m.tournaments_new_end_before_start_error()}</FieldError>
              ) : null}
            </div>
          </SettingsSection>
        </SettingsGroup>

        <SettingsGroup id="pairings-decks" title={m.tournaments_settings_toc_pairings_decks()}>
          <SettingsSection
            title={m.tournaments_settings_toc_format()}
            description={m.tournaments_new_format_description()}
            contentClassName="grid gap-x-6 gap-y-3 sm:grid-cols-2"
          >
            <div className="flex flex-col gap-1.5">
              <Label>{m.tournaments_new_play_mode_label()}</Label>
              <Select
                items={playModeItems}
                value={playMode}
                onValueChange={(value) =>
                  value && handlePlayModeChange(value as TournamentPlayMode)
                }
              >
                <SelectTrigger className="w-full" aria-label={m.tournaments_new_play_mode_label()}>
                  <SelectValue placeholder={m.tournaments_new_play_mode_label()} />
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
          </SettingsSection>

          <SettingsSection
            title={m.tournaments_section_pairings()}
            description={m.tournaments_new_pairings_description()}
          >
            <div className="flex items-center gap-3">
              <Switch
                id="t-pairings"
                checked={pairingsEnabled}
                onCheckedChange={setPairingsEnabled}
              />
              <Label htmlFor="t-pairings">{m.tournaments_new_pairings_enable()}</Label>
            </div>
            {runsRounds ? (
              <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>{m.tournaments_standings_col_rounds()}</Label>
                  <Select
                    items={roundsItems}
                    value={roundsChoice}
                    onValueChange={(value) =>
                      value && handleRoundsChoiceChange(value as TournamentRoundsChoice)
                    }
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label={m.tournaments_standings_col_rounds()}
                    >
                      <SelectValue placeholder={m.tournaments_standings_col_rounds()} />
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
                <div className="flex flex-col gap-1.5">
                  <Label>{m.tournaments_standings_col_points()}</Label>
                  <div className="flex h-8 flex-wrap items-center gap-x-4 gap-y-3">
                    {isSwiss ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Label
                            htmlFor="t-win-points"
                            className="text-muted-foreground font-normal"
                          >
                            {m.tournaments_new_points_win()}
                          </Label>
                          <Input
                            id="t-win-points"
                            value={winPointsText}
                            onChange={(event) => setWinPointsText(event.target.value)}
                            inputMode="numeric"
                            className="w-16 tabular-nums"
                            aria-label={m.tournaments_new_points_win_aria()}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label
                            htmlFor="t-draw-points"
                            className="text-muted-foreground font-normal"
                          >
                            {m.tournaments_new_points_draw()}
                          </Label>
                          <Input
                            id="t-draw-points"
                            value={drawPointsText}
                            onChange={(event) => setDrawPointsText(event.target.value)}
                            inputMode="numeric"
                            className="w-16 tabular-nums"
                            aria-label={m.tournaments_new_points_draw_aria()}
                          />
                        </div>
                      </>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <Label htmlFor="t-bye-points" className="text-muted-foreground font-normal">
                        {m.tournaments_new_points_bye()}
                      </Label>
                      <Input
                        id="t-bye-points"
                        value={byePointsText}
                        onChange={(event) => setByePointsText(event.target.value)}
                        inputMode="numeric"
                        className="w-16 tabular-nums"
                        aria-label={m.tournaments_new_points_bye_aria()}
                      />
                    </div>
                  </div>
                  {pointsInvalid ? (
                    <FieldError>{m.tournaments_new_points_error()}</FieldError>
                  ) : null}
                </div>
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
              <div className="flex flex-col gap-1.5">
                <Label>{m.tournaments_new_deck_submission_label()}</Label>
                <Select
                  items={deckItems}
                  value={deckSubmission}
                  onValueChange={(value) =>
                    value && setDeckSubmission(value as TournamentDeckSubmission)
                  }
                >
                  <SelectTrigger
                    className="w-full"
                    aria-label={m.tournaments_new_deck_submission_label()}
                  >
                    <SelectValue placeholder={m.tournaments_new_deck_submission_label()} />
                  </SelectTrigger>
                  <SelectContent>
                    {deckItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {wantsDeck ? (
                <div className="flex flex-col gap-1.5">
                  <Label>{m.tournaments_new_deadline_label()}</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <DatePicker
                      value={closeDate}
                      onChange={setCloseDate}
                      onClear={() => setCloseDate("")}
                      className="w-44"
                    />
                    <Input
                      value={closeTime}
                      onChange={(event) => setCloseTime(event.target.value)}
                      placeholder="HH:mm"
                      aria-label={m.tournaments_new_deadline_time_aria()}
                      className="w-24 tabular-nums"
                    />
                    <span className="text-muted-foreground text-sm">{tzLabel}</span>
                  </div>
                  {closeTimeInvalid ? (
                    <FieldError>{m.tournaments_new_datetime_error()}</FieldError>
                  ) : null}
                </div>
              ) : null}
            </div>
            {wantsDeck ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-3">
                  <Switch
                    id="t-allow-edits"
                    checked={lockMode === "at_deadline"}
                    onCheckedChange={(checked) =>
                      setLockMode(checked ? "at_deadline" : "on_submit")
                    }
                  />
                  <Label htmlFor="t-allow-edits">{m.tournaments_new_allow_edits_label()}</Label>
                </div>
                <span className="text-muted-foreground text-sm">
                  {m.tournaments_new_allow_edits_hint()}
                </span>
              </div>
            ) : null}
          </SettingsSection>
        </SettingsGroup>

        {runsRounds && !isTeams && !isGroupCut ? (
          <SettingsGroup
            id="custom"
            title={m.tournaments_new_custom_group()}
            collapsible
            defaultCollapsed
          >
            <SettingsSection
              title={m.tournaments_region_overview_heading()}
              description={m.tournaments_new_regions_description()}
            >
              <div className="flex items-center gap-3">
                <Switch
                  id="t-regions"
                  checked={regionsEnabled}
                  onCheckedChange={setRegionsEnabled}
                />
                <Label htmlFor="t-regions">{m.tournaments_new_regions_toggle()}</Label>
              </div>
            </SettingsSection>
          </SettingsGroup>
        ) : null}

        <SettingsGroup id="registration" title={m.tournaments_new_registration_group()}>
          <SettingsSection
            title={m.tournaments_new_self_registration_title()}
            description={m.tournaments_new_self_registration_description()}
          >
            <div className="flex items-center gap-3">
              <Switch
                id="t-self-reg"
                checked={selfRegistration}
                onCheckedChange={setSelfRegistration}
              />
              <Label htmlFor="t-self-reg">{m.tournaments_new_self_registration_toggle()}</Label>
            </div>
          </SettingsSection>
        </SettingsGroup>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => void handleCreate()}
            disabled={
              !name.trim() ||
              closeTimeInvalid ||
              scheduleInvalid ||
              pointsInvalid ||
              createTournament.isPending
            }
          >
            {m.tournaments_new_create()}
          </Button>
          <Button variant="ghost" render={<Link to="/tournaments" />}>
            {m.common_cancel()}
          </Button>
        </div>
      </div>
    </>
  );
}
