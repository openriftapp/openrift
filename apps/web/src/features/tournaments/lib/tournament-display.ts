import type { EffectiveTournamentState } from "@openrift/shared/tournament-lifecycle";
import { effectiveTournamentState } from "@openrift/shared/tournament-lifecycle";
import type {
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

export const MATCH_FORMAT_LABEL: Record<TournamentMatchFormat, string> = {
  bo1: "Best of 1",
  bo3: "Best of 3",
};

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

export function ordinalPlace(place: number): string {
  const teen = place % 100;
  if (teen >= 11 && teen <= 13) {
    return m.tournaments_lib_ordinal_other({ place });
  }
  const format = {
    1: m.tournaments_lib_ordinal_1,
    2: m.tournaments_lib_ordinal_2,
    3: m.tournaments_lib_ordinal_3,
  }[place % 10];
  return format === undefined ? m.tournaments_lib_ordinal_other({ place }) : format({ place });
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

export function canCheckDecks(myRoles: readonly TournamentViewerRole[]): boolean {
  return myRoles.includes("host") || myRoles.includes("organizer") || myRoles.includes("judge");
}

// Fetching the staff-gated API surfaces (the participant roster with its claim
// links) as a plain participant 403s, so gate on this first.
export function isTournamentStaff(myRoles: readonly TournamentViewerRole[]): boolean {
  return myRoles.includes("host") || myRoles.includes("organizer") || myRoles.includes("judge");
}

export function combineLocalDateTimeToUtc(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
    return null;
  }
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(time)) {
    return null;
  }
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (year === undefined || month === undefined) {
    return null;
  }
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

export function splitUtcToLocalDateTime(iso: string): { date: string; time: string } {
  const dt = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return {
    date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
    time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
  };
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
  const endTouched = endDate !== "" || endTime !== "";
  const endsAt = endTouched ? combineLocalDateTimeToUtc(endDate, endTime) : null;
  const endIncomplete = endTouched && endsAt === null;
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

export function localTimeZoneLabel(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function tournamentContextLabel(
  tournament: Pick<TournamentSummaryResponse, "groupName" | "host">,
): string | null {
  if (tournament.groupName) {
    return tournament.groupName;
  }
  return tournament.host.type === "organization" ? tournament.host.displayName : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatStartsIn(iso: string, now: Date = new Date()): string | null {
  const start = new Date(iso);
  if (start.getTime() <= now.getTime()) {
    return null;
  }
  const startOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startOfDay(start) - startOfDay(now)) / DAY_MS);
  if (days <= 0) {
    return m.tournaments_lib_starts_in_today();
  }
  if (days === 1) {
    return m.tournaments_lib_starts_in_tomorrow();
  }
  return m.tournaments_lib_starts_in_days({ days });
}

export { effectiveTournamentState } from "@openrift/shared/tournament-lifecycle";
export type { EffectiveTournamentState } from "@openrift/shared/tournament-lifecycle";

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
