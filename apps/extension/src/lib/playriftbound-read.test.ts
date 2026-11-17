// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { playriftboundOrganizerEvent, readPlayriftboundEvent } from "./playriftbound-read";

const ORG = "019fce9f-5f7b-7f02-8667-f16080d0f063";
const EVENT = "117163142476069250";
const EVENT_HASH = "a".repeat(64);
const DECK_HASH = "b".repeat(64);
const MANIFEST = `{"format":"apollo-persisted-query-manifest","operations":[{"id":"${EVENT_HASH}","name":"GetCompeteTournamentForRiftboundAdmin","type":"query"},{"id":"${DECK_HASH}","name":"RiftboundDeckSubmissionForOrganizer","type":"query"}]}`;
const SAVED_AT = "2026-11-16T08:55:34.591217Z";

describe("playriftboundOrganizerEvent", () => {
  it("reads the organizer and event from the organizer's event pages", () => {
    expect(
      playriftboundOrganizerEvent(`https://rgn.playriftbound.com/de-DE/org/${ORG}/events/${EVENT}`),
    ).toEqual({ orgId: ORG, eventId: EVENT });
    expect(
      playriftboundOrganizerEvent(
        `https://rgn.playriftbound.com/en-US/org/${ORG}/events/${EVENT}/edit`,
      ),
    ).toEqual({ orgId: ORG, eventId: EVENT });
  });

  it("ignores public event pages, the event list and other hosts", () => {
    expect(playriftboundOrganizerEvent(`https://playriftbound.com/en-US/events/${EVENT}`)).toBe(
      undefined,
    );
    expect(
      playriftboundOrganizerEvent(`https://rgn.playriftbound.com/de-DE/org/${ORG}/events`),
    ).toBeUndefined();
    expect(
      playriftboundOrganizerEvent(`https://example.com/de-DE/org/${ORG}/events/${EVENT}`),
    ).toBeUndefined();
    expect(playriftboundOrganizerEvent("not a url")).toBeUndefined();
  });
});

function player(id: string, name: string) {
  return { id, displayName: name, tagLine: "EUW" };
}

const TOURNAMENT = {
  name: "Summoner Skirmish",
  startsAt: "2026-11-22T13:00:00Z",
  tournamentRegistrants: [
    {
      status: "REGISTERED",
      player: player("p1", "Poro Snax"),
      deckSubmission: { id: "d1", isLate: false, lastUpdatedAt: "2026-11-16T08:55:34Z" },
    },
    { status: "REGISTERED", player: player("p2", "Teemo Main"), deckSubmission: null },
    { status: "WAITLISTED", player: player("p3", "Bandle Scout"), deckSubmission: null },
  ],
  tournamentParticipants: [{ status: "DROPPED", player: player("p2", "Teemo Main") }],
};

interface Call {
  url: string;
  headers: Record<string, string>;
}

function stubSite(answers: Record<string, unknown>, scripts = [MANIFEST]) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://assets.test/")) {
        const index = Number(url.slice("https://assets.test/".length, -3));
        return Promise.resolve(new Response(scripts[index] ?? ""));
      }
      calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
      const operation = new URL(url, "https://rgn.playriftbound.com").searchParams.get(
        "operationName",
      );
      return Promise.resolve(Response.json(answers[operation ?? ""] ?? { data: null }));
    }),
  );
  for (const [index] of scripts.entries()) {
    const script = document.createElement("script");
    script.src = `https://assets.test/${index}.js`;
    script.type = "text/plain";
    document.head.append(script);
  }
  return calls;
}

describe("readPlayriftboundEvent", () => {
  beforeEach(() => {
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.head.replaceChildren();
  });

  it("reads the field and fetches each submitted deck with the organizer's headers", async () => {
    const calls = stubSite({
      GetCompeteTournamentForRiftboundAdmin: {
        data: { competeTournamentForOrganizer: TOURNAMENT },
      },
      RiftboundDeckSubmissionForOrganizer: {
        data: {
          riftboundDeckSubmissionForOrganizer: {
            deckText: "MainDeck:\n3 Defy",
            lastSavedAt: "2026-11-16T08:55:34.591217Z",
          },
        },
      },
    });

    const result = await readPlayriftboundEvent(ORG, EVENT);

    expect(result).toEqual({
      ok: true,
      payload: {
        event: { eventId: EVENT, name: "Summoner Skirmish", startsAt: "2026-11-22T13:00:00Z" },
        registrants: [
          {
            playerId: "p1",
            displayName: "Poro Snax",
            tagLine: "EUW",
            dropped: false,
            deck: { deckText: "MainDeck:\n3 Defy", lastSavedAt: "2026-11-16T08:55:34.591217Z" },
          },
          { playerId: "p2", displayName: "Teemo Main", tagLine: "EUW", dropped: true, deck: null },
        ],
        readAt: expect.any(String),
      },
    });
    expect(calls).toHaveLength(2);
    const deckCall = new URL(calls[1]?.url ?? "", "https://rgn.playriftbound.com");
    expect(JSON.parse(deckCall.searchParams.get("variables") ?? "")).toEqual({
      esportsTournamentId: EVENT,
      playerId: "p1",
    });
    expect(JSON.parse(deckCall.searchParams.get("extensions") ?? "")).toEqual({
      persistedQuery: { version: 1, sha256Hash: DECK_HASH },
    });
    expect(calls[0]?.headers).toMatchObject({
      "apollographql-client-name": "Esports Web",
      "apollographql-client-version": "openrift",
      "x-organizer-id": ORG,
    });
  });

  it("says so when the site's query list cannot be found", async () => {
    stubSite({}, ["console.log(1)"]);
    expect(await readPlayriftboundEvent(ORG, EVENT)).toEqual({
      ok: false,
      error: expect.stringMatching(/query list/u),
    });
  });

  it("passes the site's refusal on", async () => {
    stubSite({
      GetCompeteTournamentForRiftboundAdmin: { errors: [{ message: "No client headers set" }] },
    });
    expect(await readPlayriftboundEvent(ORG, EVENT)).toEqual({
      ok: false,
      error: "GetCompeteTournamentForRiftboundAdmin: No client headers set",
    });
  });

  it("reads the status in any case and keeps an empty submission", async () => {
    stubSite({
      GetCompeteTournamentForRiftboundAdmin: {
        data: {
          competeTournamentForOrganizer: {
            ...TOURNAMENT,
            tournamentRegistrants: [
              {
                status: "registered",
                player: player("p1", "Poro Snax"),
                deckSubmission: { id: "d1" },
              },
            ],
            tournamentParticipants: [],
          },
        },
      },
      RiftboundDeckSubmissionForOrganizer: {
        data: { riftboundDeckSubmissionForOrganizer: { deckText: "", lastSavedAt: SAVED_AT } },
      },
    });
    const result = await readPlayriftboundEvent(ORG, EVENT);
    expect(result.ok && result.payload).toMatchObject({
      registrants: [{ playerId: "p1", deck: { deckText: "", lastSavedAt: SAVED_AT } }],
    });
  });

  it("stops when the site lists fewer registered players than it counts", async () => {
    stubSite({
      GetCompeteTournamentForRiftboundAdmin: {
        data: {
          competeTournamentForOrganizer: {
            ...TOURNAMENT,
            registrantCounts: [{ status: "REGISTERED", count: 40 }],
          },
        },
      },
    });
    expect(await readPlayriftboundEvent(ORG, EVENT)).toEqual({
      ok: false,
      error: "The site listed 2 of 40 registered players. Reload the event page and try again.",
    });
  });

  it("stops when a submitted deck does not load", async () => {
    stubSite({
      GetCompeteTournamentForRiftboundAdmin: {
        data: { competeTournamentForOrganizer: TOURNAMENT },
      },
      RiftboundDeckSubmissionForOrganizer: { data: { riftboundDeckSubmissionForOrganizer: null } },
    });
    expect(await readPlayriftboundEvent(ORG, EVENT)).toEqual({
      ok: false,
      error: "Could not read the deck of Poro Snax.",
    });
  });

  it("asks whether the user organizes the event when it comes back empty", async () => {
    stubSite({
      GetCompeteTournamentForRiftboundAdmin: { data: { competeTournamentForOrganizer: null } },
    });
    expect(await readPlayriftboundEvent(ORG, EVENT)).toEqual({
      ok: false,
      error: expect.stringMatching(/organizer/u),
    });
  });
});
