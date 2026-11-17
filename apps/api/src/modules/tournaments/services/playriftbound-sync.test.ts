import type { PlayriftboundSyncRegistrant } from "@openrift/shared/playriftbound-sync";
import { describe, expect, it } from "vitest";

import type { TournamentParticipant } from "../repositories/tournaments-shared.js";
import type { PlayriftboundSyncState } from "./playriftbound-sync.js";
import { planPlayriftboundPush } from "./playriftbound-sync.js";

const SAVED = "2026-11-16T08:55:34.591217Z";

function registrant(
  playerId: string,
  overrides: Partial<PlayriftboundSyncRegistrant> = {},
): PlayriftboundSyncRegistrant {
  return {
    playerId,
    displayName: `Player ${playerId}`,
    tagLine: "EUW",
    dropped: false,
    deck: { deckText: "MainDeck:\n3 Defy", lastSavedAt: SAVED },
    ...overrides,
  };
}

function participant(
  externalId: string,
  sourceDeckSavedAt: Date | null = null,
  id = "part-1",
): TournamentParticipant {
  return { id, externalId, sourceDeckSavedAt } as TournamentParticipant;
}

function state(
  participants: TournamentParticipant[] = [],
  entries: { externalId: string; participantId: string }[] = [],
): PlayriftboundSyncState {
  return {
    participantsByExternalId: new Map(participants.map((p) => [p.externalId ?? "", p])),
    entryExternalIds: new Set(entries.map((e) => e.externalId)),
    participantsWithEntry: new Set(entries.map((e) => e.participantId)),
  };
}

describe("planPlayriftboundPush", () => {
  it("pushes a new list with every sharing consent off", () => {
    expect(planPlayriftboundPush([registrant("p1")], state())).toEqual({
      kept: 0,
      entries: [
        {
          externalId: "playriftbound:p1",
          playerName: "Player p1",
          riotId: "Player p1#EUW",
          submittedAt: SAVED,
          cards: [{ name: "Defy", quantity: 3, section: "MainDeck" }],
          allowDeckPublishing: false,
          allowNameSharing: false,
          allowRiotIdSharing: false,
        },
      ],
    });
  });

  it("skips a list the player has not saved again, even after its entry was deleted", () => {
    const seated = participant("playriftbound:p1", new Date(SAVED));
    expect(planPlayriftboundPush([registrant("p1")], state([seated]))).toEqual({
      entries: [],
      kept: 0,
    });
  });

  it("pushes a list saved again without touching the consent the entry holds", () => {
    const seated = participant("playriftbound:p1", new Date("2026-11-15T10:00:00Z"));
    const plan = planPlayriftboundPush(
      [registrant("p1")],
      state([seated], [{ externalId: "playriftbound:p1", participantId: seated.id }]),
    );
    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0]).not.toHaveProperty("allowDeckPublishing");
  });

  it("keeps a list entered on OpenRift for a seated player", () => {
    const seated = participant("playriftbound:p1");
    const plan = planPlayriftboundPush(
      [registrant("p1")],
      state([seated], [{ externalId: "manual:abc", participantId: seated.id }]),
    );
    expect(plan).toEqual({ entries: [], kept: 1 });
  });

  it("pushes nothing for a player without a deck", () => {
    expect(planPlayriftboundPush([registrant("p1", { deck: null })], state())).toEqual({
      entries: [],
      kept: 0,
    });
  });

  it("leaves the Riot ID out when it would not fit", () => {
    const long = registrant("p1", { displayName: "x".repeat(110), tagLine: "y".repeat(20) });
    expect(planPlayriftboundPush([long], state()).entries[0]?.riotId).toBeNull();
  });
});
