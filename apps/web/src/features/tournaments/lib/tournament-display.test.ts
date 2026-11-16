import { effectiveTournamentState } from "@openrift/shared/tournament-lifecycle";
import type {
  TournamentParticipantResponse,
  TournamentParticipantStatus,
  TournamentStatus,
  TournamentSummaryResponse,
  TournamentViewerRole,
} from "@openrift/shared/types/api/tournament";
import { describe, expect, it } from "vitest";

import { combineLocalDateTimeToUtc } from "@/lib/date-time-input";

import {
  canManageTournament,
  applyFormatChange,
  canAddParticipants,
  participantsOpen,
  canOpenDeckCheck,
  formatChangePatch,
  hasPairing,
  isGroupCutChoice,
  pairingFromRoundsChoice,
  pairingLabel,
  pairingPluralNoun,
  pendingParticipantAction,
  roundsChoiceItems,
  roundsChoiceFor,
  compareParticipantsForList,
  compareTournamentsForList,
  formatStartsIn,
  isTournamentHost,
  isTournamentStaff,
  parseDeadlineInput,
  parseScheduleInput,
  partitionTournaments,
  primaryViewerRole,
  reportAcceptsResults,
  reportCanEdit,
  tournamentContextLabel,
  regionsAvailable,
  regionsSectionVisible,
  restorePairings,
  tournamentKindLabel,
  tournamentTokenUrl,
} from "./tournament-display";

function makeParticipant(
  status: TournamentParticipantStatus,
  displayName: string,
): TournamentParticipantResponse {
  return {
    id: `${status}-${displayName}`,
    userId: null,
    userName: null,
    displayName,
    riotId: null,
    status,
    seed: null,
    teamId: null,
    region: null,
    legendCardId: null,
    legendName: null,
    groupLabel: null,
    fixedTable: null,
    droppedAfterRound: null,
    claimToken: null,
    claimBlocked: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

function makeTournament(
  status: TournamentStatus,
  overrides: Partial<TournamentSummaryResponse> = {},
): TournamentSummaryResponse {
  return {
    id: status,
    name: `Tournament (${status})`,
    status,
    host: { type: "user", userId: "u1", orgId: null, displayName: "Host", orgSlug: null },
    groupId: null,
    groupSlug: null,
    groupName: null,
    pairingStyle: "pod",
    playMode: "1v1",
    deckSubmission: "none",
    deckFormat: "constructed",
    startsAt: "2026-06-28T18:00:00Z",
    endsAt: null,
    modules: { pairing: true, deckSubmission: false },
    participantCount: 0,
    pendingRequestCount: 0,
    myRoles: [],
    participantPreview: [],
    winner: null,
    coverLegends: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("canManageTournament", () => {
  it("is true for host or organizer", () => {
    expect(canManageTournament(["host"])).toBe(true);
    expect(canManageTournament(["organizer"])).toBe(true);
    expect(canManageTournament(["organizer", "participant"])).toBe(true);
  });

  it("is false for judge, participant, or empty", () => {
    expect(canManageTournament(["judge"])).toBe(false);
    expect(canManageTournament(["participant"])).toBe(false);
    expect(canManageTournament([])).toBe(false);
  });
});

describe("isTournamentHost", () => {
  it("only matches the host role", () => {
    expect(isTournamentHost(["host"])).toBe(true);
    expect(isTournamentHost(["organizer"])).toBe(false);
    expect(isTournamentHost([])).toBe(false);
  });
});

describe("isTournamentStaff", () => {
  it("includes judges", () => {
    expect(isTournamentStaff(["judge"])).toBe(true);
    expect(isTournamentStaff(["host"])).toBe(true);
    expect(isTournamentStaff(["organizer"])).toBe(true);
  });

  it("excludes participant", () => {
    expect(isTournamentStaff(["participant"])).toBe(false);
  });
});

describe("applyFormatChange", () => {
  const pod1v1 = {
    playMode: "1v1",
    pairingStyle: "pod",
    matchFormat: "bo1",
    format: "rounds",
    regionsEnabled: true,
  } as const;

  it("turns regions off and leaves pod when switching to 2v2", () => {
    expect(applyFormatChange(pod1v1, { playMode: "2v2" })).toEqual({
      playMode: "2v2",
      pairingStyle: "swiss",
      matchFormat: "bo1",
      format: "rounds",
      regionsEnabled: false,
    });
  });

  it("forces 1v1 and clears regions for a group cut", () => {
    expect(
      applyFormatChange(
        { ...pod1v1, playMode: "2v2", pairingStyle: "swiss" },
        { roundsChoice: "group-cut-bo3" },
      ),
    ).toEqual({
      playMode: "1v1",
      pairingStyle: "swiss",
      matchFormat: "bo3",
      format: "group_cut",
      regionsEnabled: false,
    });
  });

  it("picks pod for 1v1 and swiss for 2v2 when pairings turn on", () => {
    const off = { ...pod1v1, pairingStyle: "none" } as const;
    expect(applyFormatChange(off, { pairingsEnabled: true }).pairingStyle).toBe("pod");
    expect(
      applyFormatChange({ ...off, playMode: "2v2" }, { pairingsEnabled: true }).pairingStyle,
    ).toBe("swiss");
  });

  it("leaves the group cut when pairings turn off", () => {
    const groupCut = { ...pod1v1, pairingStyle: "swiss", format: "group_cut" } as const;
    expect(applyFormatChange(groupCut, { pairingsEnabled: false })).toMatchObject({
      pairingStyle: "none",
      format: "rounds",
    });
  });

  it("keeps pairings off when switching to 2v2", () => {
    const off = { ...pod1v1, pairingStyle: "none" } as const;
    expect(applyFormatChange(off, { playMode: "2v2" })).toMatchObject({
      playMode: "2v2",
      pairingStyle: "none",
      regionsEnabled: false,
    });
  });

  it("sends only the changed fields", () => {
    expect(formatChangePatch(pod1v1, { playMode: "2v2" })).toEqual({
      playMode: "2v2",
      pairingStyle: "swiss",
      regionsEnabled: false,
    });
  });
});

describe("regionsAvailable", () => {
  it("offers regions only on 1v1 round events", () => {
    expect(regionsAvailable({ pairingStyle: "pod", playMode: "1v1", format: "rounds" })).toBe(true);
    expect(regionsAvailable({ pairingStyle: "swiss", playMode: "1v1", format: "group_cut" })).toBe(
      false,
    );
    expect(regionsAvailable({ pairingStyle: "swiss", playMode: "2v2", format: "rounds" })).toBe(
      false,
    );
  });
});

describe("regionsSectionVisible", () => {
  it("keeps the switch on a group-cut event that already has regions on", () => {
    const groupCut = { pairingStyle: "swiss", playMode: "1v1", format: "group_cut" } as const;
    expect(regionsSectionVisible({ ...groupCut, regionsEnabled: true })).toBe(true);
    expect(regionsSectionVisible({ ...groupCut, regionsEnabled: false })).toBe(false);
  });
});

describe("restorePairings", () => {
  const off = {
    playMode: "1v1",
    pairingStyle: "none",
    matchFormat: "bo1",
    format: "rounds",
    regionsEnabled: false,
  } as const;

  it("brings back the last rounds choice", () => {
    expect(restorePairings(off, "swiss-bo3")).toMatchObject({
      pairingStyle: "swiss",
      matchFormat: "bo3",
    });
    expect(restorePairings(off, "group-cut-bo1")).toMatchObject({ format: "group_cut" });
  });

  it("falls back to the default when the last choice does not fit 2v2", () => {
    expect(restorePairings({ ...off, playMode: "2v2" }, "pod")).toMatchObject({
      playMode: "2v2",
      pairingStyle: "swiss",
      format: "rounds",
    });
    expect(restorePairings(off, null)).toMatchObject({ pairingStyle: "pod" });
  });
});

describe("canOpenDeckCheck", () => {
  it("opens for staff when decks are collected", () => {
    expect(canOpenDeckCheck({ deckSubmission: "optional", myRoles: ["judge"] })).toBe(true);
  });

  it("stays closed without deck submission or for players", () => {
    expect(canOpenDeckCheck({ deckSubmission: "none", myRoles: ["host"] })).toBe(false);
    expect(canOpenDeckCheck({ deckSubmission: "required", myRoles: ["participant"] })).toBe(false);
  });
});

describe("participantsOpen", () => {
  it("is open until the event completes or is cancelled", () => {
    expect(participantsOpen("setup")).toBe(true);
    expect(participantsOpen("running")).toBe(true);
    expect(participantsOpen("completed")).toBe(false);
    expect(participantsOpen("cancelled")).toBe(false);
  });
});

describe("canAddParticipants", () => {
  it("lets staff add players until the event is over", () => {
    expect(canAddParticipants({ status: "setup", myRoles: ["judge"] })).toBe(true);
    expect(canAddParticipants({ status: "running", myRoles: ["host"] })).toBe(true);
  });

  it("refuses a completed or cancelled event, as the API does, and non-staff", () => {
    expect(canAddParticipants({ status: "completed", myRoles: ["host"] })).toBe(false);
    expect(canAddParticipants({ status: "cancelled", myRoles: ["organizer"] })).toBe(false);
    expect(canAddParticipants({ status: "setup", myRoles: ["participant"] })).toBe(false);
  });
});

describe("tournamentTokenUrl", () => {
  it("builds the landing link for each token kind", () => {
    expect(tournamentTokenUrl("claim", "abc")).toMatch(/\/tournaments\/claim\/abc$/u);
    expect(tournamentTokenUrl("staff-invite", "xyz")).toMatch(/\/tournaments\/staff-invite\/xyz$/u);
  });
});

describe("tournamentKindLabel", () => {
  it("names group-cut events", () => {
    expect(
      tournamentKindLabel({ playMode: "1v1", pairingStyle: "swiss", format: "group_cut" }),
    ).toBe("Group stage and cut tournament");
  });

  it("names 2v2 before the pairing style", () => {
    expect(tournamentKindLabel({ playMode: "2v2", pairingStyle: "swiss", format: "rounds" })).toBe(
      "2v2 team tournament",
    );
  });
});

describe("parseDeadlineInput", () => {
  it("treats both parts blank as no deadline", () => {
    expect(parseDeadlineInput("", "", null)).toEqual({
      closeAt: null,
      incomplete: false,
      afterEnd: false,
    });
  });

  it("combines a full date and time into a UTC instant", () => {
    expect(parseDeadlineInput("2026-06-10", "18:00", null).closeAt).toBe(
      combineLocalDateTimeToUtc("2026-06-10", "18:00"),
    );
  });

  it("flags a half-filled deadline", () => {
    expect(parseDeadlineInput("2026-06-10", "", null).incomplete).toBe(true);
  });

  it("flags a deadline after the end, and skips the check without one", () => {
    const endsAt = combineLocalDateTimeToUtc("2026-06-10", "12:00");
    expect(parseDeadlineInput("2026-06-10", "13:00", endsAt).afterEnd).toBe(true);
    expect(parseDeadlineInput("2026-06-10", "12:00", endsAt).afterEnd).toBe(false);
    expect(parseDeadlineInput("2026-06-10", "13:00", null).afterEnd).toBe(false);
  });
});

describe("parseScheduleInput", () => {
  it("parses a single-day event (valid start, blank end)", () => {
    const result = parseScheduleInput("2026-06-14", "20:30", "", "");
    expect(result.startsAt).not.toBeNull();
    expect(result.endsAt).toBeNull();
    expect(result.startInvalid).toBe(false);
    expect(result.endIncomplete).toBe(false);
    expect(result.endBeforeStart).toBe(false);
    expect(result.scheduleInvalid).toBe(false);
  });

  it("parses a multi-day event with a valid end after the start", () => {
    const result = parseScheduleInput("2026-06-14", "20:30", "2026-06-15", "18:00");
    expect(result.startsAt).not.toBeNull();
    expect(result.endsAt).not.toBeNull();
    expect(result.scheduleInvalid).toBe(false);
  });

  it("flags startInvalid only once a start part is touched", () => {
    const untouched = parseScheduleInput("", "", "", "");
    expect(untouched.startInvalid).toBe(false);
    expect(untouched.scheduleInvalid).toBe(true);

    const touched = parseScheduleInput("2026-06-14", "", "", "");
    expect(touched.startsAt).toBeNull();
    expect(touched.startInvalid).toBe(true);
    expect(touched.scheduleInvalid).toBe(true);
  });

  it("flags an incomplete end (only one part filled)", () => {
    const result = parseScheduleInput("2026-06-14", "20:30", "2026-06-15", "");
    expect(result.endsAt).toBeNull();
    expect(result.endIncomplete).toBe(true);
    expect(result.scheduleInvalid).toBe(true);
  });

  it("flags an end that falls before the start", () => {
    const result = parseScheduleInput("2026-06-14", "20:30", "2026-06-14", "18:00");
    expect(result.endBeforeStart).toBe(true);
    expect(result.scheduleInvalid).toBe(true);
  });

  it("allows an end equal to the start", () => {
    const result = parseScheduleInput("2026-06-14", "20:30", "2026-06-14", "20:30");
    expect(result.endBeforeStart).toBe(false);
    expect(result.scheduleInvalid).toBe(false);
  });
});

describe("tournamentContextLabel", () => {
  it("prefers the group name", () => {
    const tournament = makeTournament("setup", {
      groupName: "Allerlei Spielerei",
      host: { type: "organization", userId: null, orgId: "o1", displayName: "LGS", orgSlug: "lgs" },
    });
    expect(tournamentContextLabel(tournament)).toBe("Allerlei Spielerei");
  });

  it("falls back to an organization host's display name", () => {
    const tournament = makeTournament("setup", {
      host: { type: "organization", userId: null, orgId: "o1", displayName: "LGS", orgSlug: "lgs" },
    });
    expect(tournamentContextLabel(tournament)).toBe("LGS");
  });

  it("is null for a plain user-hosted event with no group", () => {
    expect(tournamentContextLabel(makeTournament("setup"))).toBeNull();
  });
});

describe("formatStartsIn", () => {
  const now = new Date("2026-07-16T10:00:00");

  it("is null once the instant has passed", () => {
    expect(formatStartsIn("2026-07-16T09:00:00", now)).toBeNull();
    expect(formatStartsIn(now.toISOString(), now)).toBeNull();
  });

  it("labels the same local day as today", () => {
    expect(formatStartsIn("2026-07-16T20:00:00", now)).toBe("today");
  });

  it("labels the next local day as tomorrow, even when under 24h away", () => {
    expect(formatStartsIn("2026-07-17T08:00:00", now)).toBe("tomorrow");
  });

  it("counts calendar days after that", () => {
    expect(formatStartsIn("2026-07-18T09:00:00", now)).toBe("in 2 days");
    expect(formatStartsIn("2026-08-08T13:00:00", now)).toBe("in 23 days");
  });
});

describe("primaryViewerRole", () => {
  it("returns the highest-priority role", () => {
    const roles: TournamentViewerRole[] = ["participant", "judge", "host"];
    expect(primaryViewerRole(roles)).toBe("host");
    expect(primaryViewerRole(["participant", "judge"])).toBe("judge");
    expect(primaryViewerRole(["participant"])).toBe("participant");
  });

  it("returns null when there are no roles", () => {
    expect(primaryViewerRole([])).toBeNull();
  });
});

describe("effectiveTournamentState", () => {
  const now = new Date("2026-06-28T12:00:00Z");

  it("treats an explicit cancelled status as cancelled, regardless of dates", () => {
    expect(effectiveTournamentState("2026-06-01T10:00:00Z", null, "cancelled", now)).toBe(
      "cancelled",
    );
    expect(effectiveTournamentState("2026-07-01T10:00:00Z", null, "cancelled", now)).toBe(
      "cancelled",
    );
  });

  it("treats an explicit completed status as completed (e.g. ended early)", () => {
    expect(effectiveTournamentState("2026-07-01T10:00:00Z", null, "completed", now)).toBe(
      "completed",
    );
  });

  it("is upcoming before the start", () => {
    expect(effectiveTournamentState("2026-06-28T18:00:00Z", null, "setup", now)).toBe("upcoming");
  });

  it("is in_progress between the start and the end", () => {
    expect(
      effectiveTournamentState("2026-06-28T10:00:00Z", "2026-06-28T20:00:00Z", "running", now),
    ).toBe("in_progress");
  });

  it("auto-completes once now is past the end date", () => {
    expect(
      effectiveTournamentState("2026-06-27T10:00:00Z", "2026-06-28T11:00:00Z", "running", now),
    ).toBe("completed");
  });

  it("auto-completes 24h after the start when there is no end", () => {
    expect(effectiveTournamentState("2026-06-27T11:00:00Z", null, "running", now)).toBe(
      "completed",
    );
    expect(effectiveTournamentState("2026-06-28T01:00:00Z", null, "running", now)).toBe(
      "in_progress",
    );
  });

  it("keeps a 23:00 start in_progress at the next midnight and completed ~24h later", () => {
    const start = "2026-06-27T23:00:00Z";
    expect(effectiveTournamentState(start, null, "running", new Date("2026-06-28T00:00:00Z"))).toBe(
      "in_progress",
    );
    expect(effectiveTournamentState(start, null, "running", new Date("2026-06-28T22:59:00Z"))).toBe(
      "in_progress",
    );
    expect(effectiveTournamentState(start, null, "running", new Date("2026-06-28T23:00:00Z"))).toBe(
      "completed",
    );
  });

  it("completes immediately when ends_at is set to a past instant (end early)", () => {
    expect(
      effectiveTournamentState("2026-06-28T08:00:00Z", "2026-06-28T11:00:00Z", "running", now),
    ).toBe("completed");
  });
});

describe("compareTournamentsForList", () => {
  const now = new Date("2026-06-28T12:00:00Z");

  it("orders in_progress, then upcoming, then completed/cancelled", () => {
    const inProgress = makeTournament("running", {
      id: "live",
      startsAt: "2026-06-28T10:00:00Z",
      endsAt: "2026-06-28T20:00:00Z",
    });
    const upcoming = makeTournament("setup", { id: "up", startsAt: "2026-06-29T10:00:00Z" });
    const completed = makeTournament("completed", { id: "done", startsAt: "2026-06-20T10:00:00Z" });
    const cancelled = makeTournament("cancelled", { id: "cx", startsAt: "2026-06-21T10:00:00Z" });
    const sorted = [completed, cancelled, upcoming, inProgress].toSorted((a, b) =>
      compareTournamentsForList(a, b, now),
    );
    expect(sorted.map((t) => t.id)).toEqual(["live", "up", "done", "cx"]);
  });

  it("sorts upcoming soonest-first and finished most-recent-first", () => {
    const soon = makeTournament("setup", { id: "soon", startsAt: "2026-06-29T10:00:00Z" });
    const later = makeTournament("setup", { id: "later", startsAt: "2026-07-05T10:00:00Z" });
    const recent = makeTournament("completed", { id: "recent", startsAt: "2026-06-25T10:00:00Z" });
    const older = makeTournament("completed", { id: "older", startsAt: "2026-06-10T10:00:00Z" });
    const sorted = [later, older, recent, soon].toSorted((a, b) =>
      compareTournamentsForList(a, b, now),
    );
    expect(sorted.map((t) => t.id)).toEqual(["soon", "later", "recent", "older"]);
  });
});

describe("partitionTournaments", () => {
  const now = new Date("2026-06-28T12:00:00Z");

  it("splits current (upcoming + in_progress) from past (completed + cancelled)", () => {
    const upcoming = makeTournament("setup", { id: "a", startsAt: "2026-06-29T10:00:00Z" });
    const completed = makeTournament("completed", { id: "b", startsAt: "2026-06-20T10:00:00Z" });
    const inProgress = makeTournament("running", {
      id: "c",
      startsAt: "2026-06-28T10:00:00Z",
      endsAt: "2026-06-28T20:00:00Z",
    });
    const cancelled = makeTournament("cancelled", { id: "d" });
    const { current, pastOrArchived } = partitionTournaments(
      [upcoming, completed, inProgress, cancelled],
      now,
    );
    expect(current.map((t) => t.id)).toEqual(["a", "c"]);
    expect(pastOrArchived.map((t) => t.id)).toEqual(["b", "d"]);
  });

  it("treats an auto-completed (start+24h, no end) tournament as past", () => {
    const stale = makeTournament("running", { id: "stale", startsAt: "2026-06-27T10:00:00Z" });
    const { current, pastOrArchived } = partitionTournaments([stale], now);
    expect(current).toHaveLength(0);
    expect(pastOrArchived.map((t) => t.id)).toEqual(["stale"]);
  });

  it("returns empty groups for an empty input", () => {
    expect(partitionTournaments([], now)).toEqual({ current: [], pastOrArchived: [] });
  });
});

describe("compareParticipantsForList", () => {
  it("orders by status priority: requested → invited → active → dropped → no_show", () => {
    const roster = [
      makeParticipant("no_show", "Ann"),
      makeParticipant("active", "Bob"),
      makeParticipant("requested", "Cleo"),
      makeParticipant("dropped", "Dan"),
      makeParticipant("invited", "Eve"),
    ];
    const sorted = roster.toSorted(compareParticipantsForList);
    expect(sorted.map((p) => p.status)).toEqual([
      "requested",
      "invited",
      "active",
      "dropped",
      "no_show",
    ]);
  });

  it("breaks ties within a status by display name", () => {
    const roster = [
      makeParticipant("active", "Zoe"),
      makeParticipant("active", "Amy"),
      makeParticipant("active", "Mona"),
    ];
    const sorted = roster.toSorted(compareParticipantsForList);
    expect(sorted.map((p) => p.displayName)).toEqual(["Amy", "Mona", "Zoe"]);
  });
});

describe("hasPairing", () => {
  it("is true for the round-running styles and false for none", () => {
    expect(hasPairing("pod")).toBe(true);
    expect(hasPairing("swiss")).toBe(true);
    expect(hasPairing("none")).toBe(false);
  });
});

describe("pairingLabel", () => {
  it("names every pairing by its table", () => {
    expect(pairingLabel(3)).toBe("Table 3");
    expect(pairingLabel(1)).toBe("Table 1");
  });
});

describe("pairingPluralNoun", () => {
  function pods(...sizes: number[]) {
    return sizes.map((size) => ({
      size,
      members: Array.from({ length: size }, () => ({ teamId: null })),
    }));
  }

  it("counts an all-1v1 round as matches", () => {
    expect(pairingPluralNoun(pods(2, 2, 2))).toBe("matches");
  });

  it("counts multiplayer pods as pods", () => {
    expect(pairingPluralNoun(pods(4, 4, 3))).toBe("pods");
  });

  it("falls back to the broader word for a mixed round", () => {
    expect(pairingPluralNoun(pods(2, 4))).toBe("pods");
  });

  it("counts a 2v2 team round as matches", () => {
    const teamMatch = {
      size: 4,
      members: ["team-a", "team-a", "team-b", "team-b"].map((teamId) => ({ teamId })),
    };
    expect(pairingPluralNoun([teamMatch, teamMatch])).toBe("matches");
  });

  it("uses the broader word for a round with no pairings", () => {
    expect(pairingPluralNoun([])).toBe("pods");
  });
});

describe("rounds choice", () => {
  it("offers both Swiss formats, FFA pods and both group-stage formats", () => {
    expect(roundsChoiceItems().map((item) => item.value)).toEqual([
      "swiss-bo1",
      "swiss-bo3",
      "pod",
      "group-cut-bo1",
      "group-cut-bo3",
    ]);
  });

  it("is null when pairings are off", () => {
    expect(roundsChoiceFor("none", "bo1")).toBeNull();
    expect(roundsChoiceFor("none", "bo3")).toBeNull();
  });

  it("maps pods regardless of the stored match format", () => {
    expect(roundsChoiceFor("pod", "bo1")).toBe("pod");
    expect(roundsChoiceFor("pod", "bo3")).toBe("pod");
  });

  it("splits Swiss by match format", () => {
    expect(roundsChoiceFor("swiss", "bo1")).toBe("swiss-bo1");
    expect(roundsChoiceFor("swiss", "bo3")).toBe("swiss-bo3");
  });

  it("expands every choice back to pairing fields", () => {
    expect(pairingFromRoundsChoice("swiss-bo1")).toEqual({
      pairingStyle: "swiss",
      matchFormat: "bo1",
      format: "rounds",
    });
    expect(pairingFromRoundsChoice("swiss-bo3")).toEqual({
      pairingStyle: "swiss",
      matchFormat: "bo3",
      format: "rounds",
    });
    expect(pairingFromRoundsChoice("pod")).toEqual({
      pairingStyle: "pod",
      matchFormat: "bo1",
      format: "rounds",
    });
  });

  it("maps the group-stage choices to Swiss pairing on the group_cut format", () => {
    expect(pairingFromRoundsChoice("group-cut-bo1")).toEqual({
      pairingStyle: "swiss",
      matchFormat: "bo1",
      format: "group_cut",
    });
    expect(pairingFromRoundsChoice("group-cut-bo3")).toEqual({
      pairingStyle: "swiss",
      matchFormat: "bo3",
      format: "group_cut",
    });
  });

  it("reads the group-stage choice back off the format, not the pairing style", () => {
    expect(roundsChoiceFor("swiss", "bo1", "group_cut")).toBe("group-cut-bo1");
    expect(roundsChoiceFor("swiss", "bo3", "group_cut")).toBe("group-cut-bo3");
    expect(roundsChoiceFor("swiss", "bo3", "rounds")).toBe("swiss-bo3");
  });

  it("keeps pairings off ahead of the format", () => {
    expect(roundsChoiceFor("none", "bo1", "group_cut")).toBeNull();
  });

  it("tells the group-stage choices from the rest", () => {
    expect(
      roundsChoiceItems()
        .filter((item) => isGroupCutChoice(item.value))
        .map((i) => i.value),
    ).toEqual(["group-cut-bo1", "group-cut-bo3"]);
  });

  it("round-trips every dropdown option", () => {
    for (const item of roundsChoiceItems()) {
      const { pairingStyle, matchFormat, format } = pairingFromRoundsChoice(item.value);
      expect(roundsChoiceFor(pairingStyle, matchFormat, format)).toBe(item.value);
    }
  });
});

describe("reportCanEdit", () => {
  it("allows edits only on a running event with a submit link", () => {
    expect(reportCanEdit({ canSubmit: true, status: "running" })).toBe(true);
    expect(reportCanEdit({ canSubmit: true, status: "completed" })).toBe(false);
    expect(reportCanEdit({ canSubmit: false, status: "running" })).toBe(false);
  });
});

describe("reportAcceptsResults", () => {
  const open = [{ status: "finalized" }, { status: "reporting" }];

  it("is true for a running event with an open round", () => {
    expect(reportAcceptsResults({ canSubmit: true, status: "running", rounds: open })).toBe(true);
  });

  it("is false once the event is completed, even with a round left open", () => {
    expect(reportAcceptsResults({ canSubmit: true, status: "completed", rounds: open })).toBe(
      false,
    );
  });

  it("is false between rounds", () => {
    expect(
      reportAcceptsResults({
        canSubmit: true,
        status: "running",
        rounds: [{ status: "finalized" }],
      }),
    ).toBe(false);
  });

  it("is false for a view-only link", () => {
    expect(reportAcceptsResults({ canSubmit: false, status: "running", rounds: open })).toBe(false);
  });
});

describe("pendingParticipantAction", () => {
  const running = {
    isPending: true,
    variables: { participantId: "p-1", action: "deny" as const },
  };

  it("names the running action for its own row only", () => {
    expect(pendingParticipantAction(running, "p-1")).toBe("deny");
    expect(pendingParticipantAction(running, "p-2")).toBeNull();
  });

  it("is null once the request settled", () => {
    expect(pendingParticipantAction({ ...running, isPending: false }, "p-1")).toBeNull();
  });
});
