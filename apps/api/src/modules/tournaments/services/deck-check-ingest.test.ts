import { describe, expect, it, vi } from "vitest";

import type { Repos } from "../../../deps.js";
import { createRepos, createTransact } from "../../../deps.js";
import { cardLookupSlot } from "../../../test/card-lookup.js";
import { createRecordingDb } from "../../../test/recording-db.js";
import {
  createManualDeckCheckEntry,
  ingestDeckCheckPush,
  prepareManualDeckCheckList,
  refreshEditedEntry,
  writeDeckCheckPush,
} from "./deck-check-ingest.js";

const TOURNAMENT_ID = "b0000000-0001-4000-a000-000000000001";
const PARTICIPANT_ID = "p0000000-0001-4000-a000-000000000001";
const ENTRY_ID = "c0000000-0001-4000-a000-000000000001";

function makeRepos() {
  const deckCheck = {
    createEntry: vi.fn(() =>
      Promise.resolve({ id: ENTRY_ID, tournamentId: TOURNAMENT_ID, participantId: PARTICIPANT_ID }),
    ),
    replaceEntryCards: vi.fn(() => Promise.resolve()),
    listCardsForEntry: vi.fn(() => Promise.resolve([])),
    updateEntry: vi.fn(() => Promise.resolve()),
  };
  const tournamentGroups = { syncParticipantLegendsFromDeckCheck: vi.fn(() => Promise.resolve()) };
  return {
    repos: { deckCheck, tournamentGroups } as unknown as Repos,
    deckCheck,
    tournamentGroups,
  };
}

describe("createManualDeckCheckEntry", () => {
  it("syncs the participant's legend after writing the list", async () => {
    const { repos, deckCheck, tournamentGroups } = makeRepos();

    await createManualDeckCheckEntry(repos, TOURNAMENT_ID, PARTICIPANT_ID, {
      lines: [],
      contentHash: "hash",
      cardRows: [],
    });

    expect(deckCheck.replaceEntryCards).toHaveBeenCalledWith(ENTRY_ID, []);
    expect(tournamentGroups.syncParticipantLegendsFromDeckCheck).toHaveBeenCalledWith(
      TOURNAMENT_ID,
      [PARTICIPANT_ID],
    );
  });
});

describe("refreshEditedEntry", () => {
  it("recomputes the hash and syncs the participant's legend", async () => {
    const { repos, deckCheck, tournamentGroups } = makeRepos();

    await refreshEditedEntry(repos, {
      id: ENTRY_ID,
      tournamentId: TOURNAMENT_ID,
      participantId: PARTICIPANT_ID,
    });

    expect(deckCheck.updateEntry).toHaveBeenCalledWith(ENTRY_ID, {
      contentHash: expect.any(String),
    });
    expect(tournamentGroups.syncParticipantLegendsFromDeckCheck).toHaveBeenCalledWith(
      TOURNAMENT_ID,
      [PARTICIPANT_ID],
    );
  });

  it("skips the sync for an entry without a participant", async () => {
    const { repos, tournamentGroups } = makeRepos();

    await refreshEditedEntry(repos, {
      id: ENTRY_ID,
      tournamentId: TOURNAMENT_ID,
      participantId: null,
    });

    expect(tournamentGroups.syncParticipantLegendsFromDeckCheck).not.toHaveBeenCalled();
  });
});

const HOST = { hostType: "user" as const, hostUserId: "user-1", hostOrgId: null };
const PUSH = {
  tournamentId: TOURNAMENT_ID,
  entries: [
    {
      externalId: "ext-1",
      playerName: "Vi",
      cards: [{ name: "Jinx, Loose Cannon", quantity: 3, section: "Main Deck" }],
    },
  ],
};

describe("ingestDeckCheckPush", () => {
  it("loads the card lookup on the pool before it takes the tournament lock", async () => {
    const recorded = createRecordingDb([[{ id: TOURNAMENT_ID, status: "running" }]]);

    await expect(
      ingestDeckCheckPush(
        createRepos(recorded.db),
        createTransact(recorded.db),
        HOST,
        PUSH,
        "https://openrift.test",
      ),
    ).rejects.toThrow("Unknown tournament id");

    const lockIndex = recorded.queries.findIndex((sql) => sql.includes("pg_advisory_xact_lock"));
    const lookupIndexes = recorded.queries.flatMap((sql, index) =>
      sql.includes('from "cards"') || sql.includes("catalog_versions") ? [index] : [],
    );
    expect(lockIndex).toBeGreaterThan(0);
    expect(lookupIndexes.length).toBeGreaterThan(0);
    expect(lookupIndexes.every((index) => index < lockIndex)).toBe(true);
  });

  it("resolves once and reruns only the transaction when a claim token collides", async () => {
    const catalog = {
      cards: vi.fn(() => Promise.resolve([])),
      printingLookupRows: vi.fn(() => Promise.resolve([])),
      catalogContentVersion: vi.fn(() => Promise.resolve("v1")),
    };
    const event = { id: TOURNAMENT_ID, status: "active" };
    const repos = {
      cardLookup: cardLookupSlot(catalog),
      deckCheck: {
        getEventForHost: vi.fn(() => Promise.resolve(event)),
        canonicalPrintingByCard: vi.fn(() => Promise.resolve(new Map())),
        getEntryByExternalId: vi.fn(() => Promise.resolve({ id: ENTRY_ID, contentHash: "x" })),
        listCardsForEntry: vi.fn(() => Promise.resolve([])),
        updateEntry: vi.fn(() => Promise.resolve()),
        replaceEntryCards: vi.fn(() => Promise.resolve()),
        setClaimTokenIfMissing: vi.fn(() => Promise.resolve("token")),
      },
      tournaments: { lockRounds: vi.fn(() => Promise.resolve()) },
      tournamentGroups: { syncParticipantLegendsFromDeckCheck: vi.fn(() => Promise.resolve()) },
    } as unknown as Repos;
    const collision = Object.assign(new Error("duplicate key"), {
      code: "23505",
      constraint_name: "uq_tournament_participants_claim_token",
    });
    const transact = vi
      .fn()
      .mockRejectedValueOnce(collision)
      .mockImplementation((fn: (trx: Repos) => Promise<unknown>) => fn(repos));

    const result = await ingestDeckCheckPush(repos, transact, HOST, PUSH, "https://openrift.test");

    expect(result.entriesUpdated).toBe(1);
    expect(transact).toHaveBeenCalledTimes(2);
    expect(catalog.cards).toHaveBeenCalledTimes(1);
  });

  it("refuses an archived event before mapping the sections", async () => {
    const repos = {
      deckCheck: {
        getEventForHost: vi.fn(() => Promise.resolve({ id: TOURNAMENT_ID, status: "archived" })),
      },
    } as unknown as Repos;
    const transact = vi.fn();

    await expect(
      ingestDeckCheckPush(
        repos,
        transact,
        HOST,
        {
          ...PUSH,
          entries: [{ ...PUSH.entries[0]!, cards: [{ name: "x", quantity: 1, section: "?" }] }],
        },
        "https://openrift.test",
      ),
    ).rejects.toThrow("Event is archived");
    expect(transact).not.toHaveBeenCalled();
  });

  it("refuses ids in the namespace a platform sync owns", async () => {
    const repos = {
      deckCheck: {
        getEventForHost: vi.fn(() => Promise.resolve({ id: TOURNAMENT_ID, status: "active" })),
      },
    } as unknown as Repos;
    const transact = vi.fn();

    await expect(
      ingestDeckCheckPush(
        repos,
        transact,
        HOST,
        { ...PUSH, entries: [{ ...PUSH.entries[0]!, externalId: "playriftbound:p1" }] },
        "https://openrift.test",
      ),
    ).rejects.toThrow('reserved "playriftbound:" prefix');
    expect(transact).not.toHaveBeenCalled();
  });

  it("creates a walk-in per new entry without matching participants by external id", async () => {
    const event = { id: TOURNAMENT_ID, status: "active" };
    const resolveOrCreateParticipant = vi.fn((_input: { externalId: string | null }) =>
      Promise.resolve({ id: PARTICIPANT_ID }),
    );
    const repos = {
      deckCheck: {
        getEntryByExternalId: vi.fn(() => Promise.resolve()),
        createEntry: vi.fn(() => Promise.resolve({ id: ENTRY_ID, claimToken: "token" })),
        replaceEntryCards: vi.fn(() => Promise.resolve()),
      },
      tournaments: { resolveOrCreateParticipant },
      tournamentGroups: { syncParticipantLegendsFromDeckCheck: vi.fn(() => Promise.resolve()) },
    } as unknown as Repos;
    const list = {
      entry: { ...PUSH.entries[0]!, cards: [] },
      lines: [],
      contentHash: "hash",
      cardRows: [],
    };

    await writeDeckCheckPush(repos, event as never, [list], "https://openrift.test");
    await writeDeckCheckPush(repos, event as never, [list], "https://openrift.test", {
      rosterSynced: true,
    });

    expect(resolveOrCreateParticipant.mock.calls.map((call) => call[0].externalId)).toEqual([
      null,
      "ext-1",
    ]);
  });
});

describe("prepareManualDeckCheckList", () => {
  it("rejects an unknown section", async () => {
    await expect(
      prepareManualDeckCheckList({} as Repos, [{ name: "Vi", quantity: 1, section: "attic" }]),
    ).rejects.toThrow("Unknown deck section: attic");
  });
});
