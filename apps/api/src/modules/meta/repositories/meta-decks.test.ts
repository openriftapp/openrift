import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import type { MetaReplacedDeckInput } from "./meta-decks.js";
import { metaDecksRepo } from "./meta-decks.js";

const PLAYER_ID = "00000000-0000-4000-8000-000000000001";
const DECK_ID = "00000000-0000-4000-8000-000000000002";
const CARD_ID = "00000000-0000-4000-8000-000000000003";

const card = { cardId: CARD_ID, zone: "main", quantity: 3, preferredPrintingId: null } as const;

function deck(overrides: Partial<MetaReplacedDeckInput> = {}): MetaReplacedDeckInput {
  return {
    name: "Kai'Sa Aggro",
    format: "constructed",
    cards: [card],
    listStatus: "full",
    ...overrides,
  };
}

function replace(stored: { name: string; format: string }, next: MetaReplacedDeckInput) {
  const recording = createRecordingDb([
    [{ deck_id: DECK_ID, list_status: "full" }],
    [stored],
    { numAffectedRows: 1n },
    [{ card_id: CARD_ID, zone: "main", quantity: 3, preferred_printing_id: null }],
  ]);
  return {
    recording,
    written: metaDecksRepo(recording.db).setPlayerDeck(PLAYER_ID, next, "token"),
  };
}

describe("metaDecksRepo.setPlayerDeck", () => {
  it("locks the deck row before it touches the deck's cards", async () => {
    const { recording, written } = replace({ name: "Kai'Sa Aggro", format: "constructed" }, deck());

    await written;
    expect(recording.statements[1]?.sql).toMatch(/ from "decks" .* for no key update$/u);
  });
});
