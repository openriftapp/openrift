import { localDayDiff } from "@openrift/shared/format-date";
import type { EffectiveTournamentState } from "@openrift/shared/tournament-lifecycle";
import { effectiveTournamentState } from "@openrift/shared/tournament-lifecycle";
import type {
  OrganizationRole,
  TournamentDetailResponse,
  TournamentDeckPhase,
  TournamentDeckSubmission,
  TournamentFormat,
  TournamentMatchFormat,
  TournamentPairingStyle,
  TournamentParticipantResponse,
  TournamentParticipantStatus,
  TournamentPlayMode,
  TournamentStaffRole,
  TournamentSummaryResponse,
  TournamentViewerRole,
} from "@openrift/shared/types/api/tournament";

import { combineLocalDateTimeToUtc, parseOptionalLocalInstant } from "@/lib/date-time-input";
import { getSiteUrl } from "@/lib/site-config";
import { m } from "@/paraglide/messages.js";

export function deckSubmissionLabels(): Record<TournamentDeckSubmission, string> {
  return {
    none: m.tournaments_lib_deck_submission_none(),
    optional: m.tournaments_lib_deck_submission_optional(),
    required: m.tournaments_lib_deck_submission_required(),
  };
}

export function deckPhaseLabels(): Record<TournamentDeckPhase, string> {
  return {
    open: m.tournaments_lib_deck_phase_open(),
    closed: m.tournaments_lib_deck_phase_closed(),
    locked: m.tournaments_lib_deck_phase_locked(),
  };
}

export function pairingStyleLabels(): Record<TournamentPairingStyle, string> {
  return {
    pod: m.tournaments_lib_pairing_style_pod(),
    swiss: m.tournaments_lib_pairing_style_swiss(),
    none: m.tournaments_lib_pairing_style_none(),
  };
}

export const PLAY_MODE_ITEMS: { value: TournamentPlayMode; label: string }[] = [
  { value: "1v1", label: "1v1" },
  { value: "2v2", label: "2v2" },
];

export function matchFormatLabels(): Record<TournamentMatchFormat, string> {
  return {
    bo1: m.tournaments_match_format_bo1(),
    bo3: m.tournaments_match_format_bo3(),
  };
}

// "None" is deliberately not an option: the pairings-enable switch owns that state.
export type TournamentRoundsChoice =
  | "swiss-bo1"
  | "swiss-bo3"
  | "pod"
  | "group-cut-bo1"
  | "group-cut-bo3";

export function roundsChoiceItems(): { value: TournamentRoundsChoice; label: string }[] {
  return [
    { value: "swiss-bo1", label: m.tournaments_lib_rounds_choice_swiss_bo1() },
    { value: "swiss-bo3", label: m.tournaments_lib_rounds_choice_swiss_bo3() },
    { value: "pod", label: m.tournaments_lib_rounds_choice_pod() },
    { value: "group-cut-bo1", label: m.tournaments_lib_rounds_choice_group_cut_bo1() },
    { value: "group-cut-bo3", label: m.tournaments_lib_rounds_choice_group_cut_bo3() },
  ];
}

export function roundsChoiceFor(
  pairingStyle: TournamentPairingStyle,
  matchFormat: TournamentMatchFormat,
  format: TournamentFormat = "rounds",
): TournamentRoundsChoice | null {
  if (pairingStyle === "none") {
    return null;
  }
  if (format === "group_cut") {
    return matchFormat === "bo3" ? "group-cut-bo3" : "group-cut-bo1";
  }
  if (pairingStyle === "pod") {
    return "pod";
  }
  return matchFormat === "bo3" ? "swiss-bo3" : "swiss-bo1";
}

export function pairingFromRoundsChoice(choice: TournamentRoundsChoice): {
  pairingStyle: TournamentPairingStyle;
  matchFormat: TournamentMatchFormat;
  format: TournamentFormat;
} {
  if (choice === "pod") {
    return { pairingStyle: "pod", matchFormat: "bo1", format: "rounds" };
  }
  if (choice === "group-cut-bo1" || choice === "group-cut-bo3") {
    return {
      pairingStyle: "swiss",
      matchFormat: choice === "group-cut-bo3" ? "bo3" : "bo1",
      format: "group_cut",
    };
  }
  return {
    pairingStyle: "swiss",
    matchFormat: choice === "swiss-bo3" ? "bo3" : "bo1",
    format: "rounds",
  };
}

export function isGroupCutChoice(choice: TournamentRoundsChoice): boolean {
  return choice === "group-cut-bo1" || choice === "group-cut-bo3";
}

export function hasPairing(style: TournamentPairingStyle): boolean {
  return style !== "none";
}

export interface TournamentFormatState {
  playMode: TournamentPlayMode;
  pairingStyle: TournamentPairingStyle;
  matchFormat: TournamentMatchFormat;
  format: TournamentFormat;
  regionsEnabled: boolean;
}

export type TournamentFormatChange =
  | { playMode: TournamentPlayMode }
  | { roundsChoice: TournamentRoundsChoice }
  | { pairingsEnabled: boolean };

export function applyFormatChange(
  current: TournamentFormatState,
  change: TournamentFormatChange,
): TournamentFormatState {
  if ("playMode" in change) {
    if (change.playMode === "1v1") {
      return { ...current, playMode: "1v1" };
    }
    const leavesPod =
      hasPairing(current.pairingStyle) &&
      (current.pairingStyle === "pod" || current.format === "group_cut");
    return {
      ...current,
      playMode: "2v2",
      ...(leavesPod ? { pairingStyle: "swiss", matchFormat: "bo1", format: "rounds" } : {}),
      regionsEnabled: false,
    };
  }
  if ("roundsChoice" in change) {
    const next = { ...current, ...pairingFromRoundsChoice(change.roundsChoice) };
    return next.format === "group_cut" ? { ...next, playMode: "1v1", regionsEnabled: false } : next;
  }
  if (!change.pairingsEnabled) {
    return { ...current, pairingStyle: "none", format: "rounds" };
  }
  return {
    ...current,
    pairingStyle: current.playMode === "2v2" ? "swiss" : "pod",
    matchFormat: "bo1",
    format: "rounds",
  };
}

export function restorePairings(
  current: TournamentFormatState,
  lastChoice: TournamentRoundsChoice | null,
): TournamentFormatState {
  const fitsTeams = lastChoice === "swiss-bo1" || lastChoice === "swiss-bo3";
  if (lastChoice === null || (current.playMode === "2v2" && !fitsTeams)) {
    return applyFormatChange(current, { pairingsEnabled: true });
  }
  return applyFormatChange(current, { roundsChoice: lastChoice });
}

export function formatChangePatch(
  current: TournamentFormatState,
  change: TournamentFormatChange,
): Partial<TournamentFormatState> {
  const next = applyFormatChange(current, change);
  const patch: Partial<TournamentFormatState> = {};
  for (const key of Object.keys(next) as (keyof TournamentFormatState)[]) {
    if (next[key] !== current[key]) {
      Object.assign(patch, { [key]: next[key] });
    }
  }
  return patch;
}

export function regionsAvailable(
  tournament: Pick<TournamentFormatState, "pairingStyle" | "playMode" | "format">,
): boolean {
  return (
    hasPairing(tournament.pairingStyle) &&
    tournament.playMode !== "2v2" &&
    tournament.format !== "group_cut"
  );
}

// Keyed on the pairing's own seat count, not the tournament's pairing style:
// the pod engine seats a 2-player pod when the field forces one, and that
// pairing is a match no matter which engine drew it.
export function isMatchPairing(size: number): boolean {
  return size === 2;
}

/** The pod number is the table the pairing sits at. */
export function pairingLabel(podNumber: number): string {
  return m.tournaments_lib_pairing_label_table({ number: podNumber });
}

export function isAllMatchRound(sizes: readonly number[]): boolean {
  return sizes.length > 0 && sizes.every((size) => isMatchPairing(size));
}

export function pairingPluralNoun(sizes: readonly number[]): string {
  return isAllMatchRound(sizes)
    ? m.tournaments_lib_pairing_noun_matches()
    : m.tournaments_lib_pairing_noun_pods();
}

export function deckSubmissionItems(): { value: TournamentDeckSubmission; label: string }[] {
  const labels = deckSubmissionLabels();
  return [
    { value: "none", label: labels.none },
    { value: "optional", label: labels.optional },
    { value: "required", label: labels.required },
  ];
}

export function participantStatusLabels(): Record<TournamentParticipantStatus, string> {
  return {
    requested: m.tournaments_lib_participant_status_requested(),
    invited: m.tournaments_lib_participant_status_invited(),
    active: m.tournaments_lib_participant_status_active(),
    dropped: m.tournaments_lib_participant_status_dropped(),
    no_show: m.tournaments_lib_participant_status_no_show(),
  };
}

export function staffRoleLabels(): Record<TournamentStaffRole, string> {
  return {
    organizer: m.tournaments_lib_staff_role_organizer(),
    judge: m.tournaments_lib_staff_role_judge(),
  };
}

export function organizationRoleLabels(): Record<OrganizationRole, string> {
  return {
    owner: m.tournaments_org_role_owner(),
    manager: m.tournaments_org_role_manager(),
    judge: m.tournaments_org_role_judge(),
  };
}

export function viewerRoleLabels(): Record<TournamentViewerRole, string> {
  return {
    host: m.tournaments_lib_viewer_role_host(),
    organizer: m.tournaments_lib_staff_role_organizer(),
    judge: m.tournaments_lib_staff_role_judge(),
    participant: m.tournaments_lib_viewer_role_participant(),
  };
}

export function canManageTournament(myRoles: readonly TournamentViewerRole[]): boolean {
  return myRoles.includes("host") || myRoles.includes("organizer");
}

export function isTournamentHost(myRoles: readonly TournamentViewerRole[]): boolean {
  return myRoles.includes("host");
}

// Fetching the staff-gated API surfaces (the participant roster with its claim
// links) as a plain participant 403s, so gate on this first.
export function isTournamentStaff(myRoles: readonly TournamentViewerRole[]): boolean {
  return myRoles.includes("host") || myRoles.includes("organizer") || myRoles.includes("judge");
}

export function regionsSectionVisible(
  tournament: Pick<
    TournamentFormatState,
    "pairingStyle" | "playMode" | "format" | "regionsEnabled"
  >,
): boolean {
  return regionsAvailable(tournament) || tournament.regionsEnabled;
}

export function canOpenDeckCheck(
  detail: Pick<TournamentDetailResponse, "deckSubmission" | "myRoles">,
): boolean {
  return detail.deckSubmission !== "none" && isTournamentStaff(detail.myRoles);
}

export function participantsOpen(status: TournamentDetailResponse["status"]): boolean {
  return status !== "completed" && status !== "cancelled";
}

export function canAddParticipants(
  detail: Pick<TournamentDetailResponse, "status" | "myRoles">,
): boolean {
  return isTournamentStaff(detail.myRoles) && participantsOpen(detail.status);
}

export type ParticipantAction =
  | "drop"
  | "reactivate"
  | "approve"
  | "deny"
  | "remove"
  | "unlink"
  | "reissue";

export function pendingParticipantAction(
  mutation: {
    isPending: boolean;
    variables?: { participantId: string; action: ParticipantAction };
  },
  participantId: string,
): ParticipantAction | null {
  return mutation.isPending && mutation.variables?.participantId === participantId
    ? mutation.variables.action
    : null;
}

type TournamentTokenKind = "report" | "submit" | "staff-invite" | "claim";

export function tournamentTokenUrl(kind: TournamentTokenKind, token: string): string {
  return `${getSiteUrl()}/tournaments/${kind}/${token}`;
}

export function tournamentKindLabel(
  tournament: Pick<TournamentDetailResponse, "playMode" | "pairingStyle" | "format">,
): string {
  if (tournament.playMode === "2v2") {
    return m.tournaments_hero_kind_2v2();
  }
  if (tournament.format === "group_cut") {
    return m.tournaments_hero_kind_group_cut();
  }
  if (tournament.pairingStyle === "pod") {
    return m.tournaments_hero_kind_pod();
  }
  if (tournament.pairingStyle === "swiss") {
    return m.tournaments_hero_kind_swiss();
  }
  return m.tournaments_hero_kind_default();
}

export interface ParsedScheduleInput {
  startsAt: string | null;
  endsAt: string | null;
  startInvalid: boolean;
  endIncomplete: boolean;
  endBeforeStart: boolean;
  scheduleInvalid: boolean;
}

export function parseScheduleInput(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
): ParsedScheduleInput {
  const startsAt = combineLocalDateTimeToUtc(startDate, startTime);
  const startTouched = startDate !== "" || startTime !== "";
  const { instant: endsAt, incomplete: endIncomplete } = parseOptionalLocalInstant(
    endDate,
    endTime,
  );
  const endBeforeStart = endsAt !== null && startsAt !== null && endsAt < startsAt;
  return {
    startsAt,
    endsAt,
    startInvalid: startTouched && startsAt === null,
    endIncomplete,
    endBeforeStart,
    scheduleInvalid: startsAt === null || endIncomplete || endBeforeStart,
  };
}

interface ParsedDeadlineInput {
  closeAt: string | null;
  incomplete: boolean;
  afterEnd: boolean;
}

/** Both parts blank means no deadline; `endsAt` null skips the after-end check. */
export function parseDeadlineInput(
  date: string,
  time: string,
  endsAt: string | null,
): ParsedDeadlineInput {
  const { instant: closeAt, incomplete } = parseOptionalLocalInstant(date, time);
  return {
    closeAt,
    incomplete,
    afterEnd: closeAt !== null && endsAt !== null && Date.parse(closeAt) > Date.parse(endsAt),
  };
}

export function tournamentContextLabel(
  tournament: Pick<TournamentSummaryResponse, "groupName" | "host">,
): string | null {
  if (tournament.groupName) {
    return tournament.groupName;
  }
  return tournament.host.type === "organization" ? tournament.host.displayName : null;
}

export function formatStartsIn(iso: string, now: Date = new Date()): string | null {
  if (new Date(iso).getTime() <= now.getTime()) {
    return null;
  }
  const days = localDayDiff(now, iso);
  if (days <= 0) {
    return m.tournaments_lib_starts_in_today();
  }
  if (days === 1) {
    return m.tournaments_lib_starts_in_tomorrow();
  }
  return m.tournaments_lib_starts_in_days({ days });
}

export function effectiveStateLabels(): Record<EffectiveTournamentState, string> {
  return {
    upcoming: m.tournaments_lib_state_upcoming(),
    in_progress: m.tournaments_lib_state_in_progress(),
    completed: m.tournaments_lib_state_completed(),
    cancelled: m.tournaments_lib_state_cancelled(),
  };
}

const EFFECTIVE_STATE_ORDER: Record<EffectiveTournamentState, number> = {
  in_progress: 0,
  upcoming: 1,
  completed: 2,
  cancelled: 3,
};

export function compareTournamentsForList(
  a: TournamentSummaryResponse,
  b: TournamentSummaryResponse,
  now: Date = new Date(),
): number {
  const stateA = effectiveTournamentState(a.startsAt, a.endsAt, a.status, now);
  const stateB = effectiveTournamentState(b.startsAt, b.endsAt, b.status, now);
  const byState = EFFECTIVE_STATE_ORDER[stateA] - EFFECTIVE_STATE_ORDER[stateB];
  if (byState !== 0) {
    return byState;
  }
  const finished = stateA === "completed" || stateA === "cancelled";
  return finished ? b.startsAt.localeCompare(a.startsAt) : a.startsAt.localeCompare(b.startsAt);
}

export function partitionTournaments(
  tournaments: readonly TournamentSummaryResponse[],
  now: Date = new Date(),
): {
  current: TournamentSummaryResponse[];
  pastOrArchived: TournamentSummaryResponse[];
} {
  const current: TournamentSummaryResponse[] = [];
  const pastOrArchived: TournamentSummaryResponse[] = [];
  for (const tournament of tournaments) {
    const state = effectiveTournamentState(
      tournament.startsAt,
      tournament.endsAt,
      tournament.status,
      now,
    );
    if (state === "completed" || state === "cancelled") {
      pastOrArchived.push(tournament);
    } else {
      current.push(tournament);
    }
  }
  return { current, pastOrArchived };
}

const PARTICIPANT_STATUS_ORDER: Record<TournamentParticipantStatus, number> = {
  requested: 0,
  invited: 1,
  active: 2,
  dropped: 3,
  no_show: 4,
};

export function compareParticipantsForList(
  a: TournamentParticipantResponse,
  b: TournamentParticipantResponse,
): number {
  return (
    PARTICIPANT_STATUS_ORDER[a.status] - PARTICIPANT_STATUS_ORDER[b.status] ||
    a.displayName.localeCompare(b.displayName)
  );
}

export function primaryViewerRole(
  myRoles: readonly TournamentViewerRole[],
): TournamentViewerRole | null {
  const order: TournamentViewerRole[] = ["host", "organizer", "judge", "participant"];
  for (const role of order) {
    if (myRoles.includes(role)) {
      return role;
    }
  }
  return null;
}

export function reportCanEdit(report: { canSubmit: boolean; status: string }): boolean {
  return report.canSubmit && report.status === "running";
}

export function reportAcceptsResults(report: {
  canSubmit: boolean;
  status: string;
  rounds: readonly { status: string }[];
}): boolean {
  return reportCanEdit(report) && report.rounds.some((round) => round.status === "reporting");
}
