import { describe, expect, it, vi } from "vitest";

import type { Repos } from "../../../deps.js";
import { createManualDeckCheckEntry, refreshEditedEntry } from "./deck-check-ingest.js";

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

    await createManualDeckCheckEntry(repos, TOURNAMENT_ID, {
      participantId: PARTICIPANT_ID,
      cards: [],
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
