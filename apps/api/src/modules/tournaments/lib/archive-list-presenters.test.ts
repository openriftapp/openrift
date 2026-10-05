import { describe, expect, it } from "vitest";

import {
  toArchiveListEvent,
  toArchiveListParticipant,
  toUvsgamesEventSuggestion,
} from "./archive-list-presenters.js";

const START = new Date("2026-03-14T10:00:00.000Z");

describe("toArchiveListEvent", () => {
  const event = {
    name: "Summoner Skirmish",
    startAt: START,
    displayStatus: "Completed",
    playerCount: 24,
    storeName: "Piltover Games",
    resultsFetchedAt: new Date("2026-03-14T20:00:00.000Z"),
  };

  it("serializes the dates", () => {
    expect(toArchiveListEvent(event)).toEqual({
      name: "Summoner Skirmish",
      startAt: "2026-03-14T10:00:00.000Z",
      displayStatus: "Completed",
      playerCount: 24,
      storeName: "Piltover Games",
      resultsFetchedAt: "2026-03-14T20:00:00.000Z",
    });
  });

  it("keeps a missing results fetch null", () => {
    expect(toArchiveListEvent({ ...event, resultsFetchedAt: null }).resultsFetchedAt).toBeNull();
  });
});

describe("toArchiveListParticipant", () => {
  const participant = { id: "p1", displayName: "Jinx" };

  it("reads state, eligibility and unmatched lines from the entry", () => {
    expect(
      toArchiveListParticipant(
        participant,
        {
          state: "checked",
          allowDeckPublishing: true,
          allowNameSharing: true,
          unmatchedLineCount: 2,
        },
        "jinx#1",
      ),
    ).toEqual({
      participantId: "p1",
      displayName: "Jinx",
      entryState: "checked",
      eligibility: "ready",
      unmatchedLines: 2,
      suggestedIdentity: "jinx#1",
    });
  });

  it("reports no list for a participant without an entry", () => {
    expect(toArchiveListParticipant(participant, undefined, null)).toEqual({
      participantId: "p1",
      displayName: "Jinx",
      entryState: null,
      eligibility: "no_list",
      unmatchedLines: 0,
      suggestedIdentity: null,
    });
  });
});

describe("toUvsgamesEventSuggestion", () => {
  it("serializes the start date and drops the other columns", () => {
    const row = {
      externalId: "123",
      name: "Summoner Skirmish",
      startAt: START,
      storeId: 7,
      storeName: "Piltover Games",
      eventFormat: null,
    };
    expect(toUvsgamesEventSuggestion(row)).toEqual({
      externalId: "123",
      name: "Summoner Skirmish",
      startAt: "2026-03-14T10:00:00.000Z",
      storeName: "Piltover Games",
    });
  });
});
