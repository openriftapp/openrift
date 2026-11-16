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

function deckUpdate(queries: string[]): string | undefined {
  return queries.find((query) => query.startsWith('update "decks"'));
}

describe("metaDecksRepo.setPlayerDeck", () => {
  it("keeps the stored format config when only the name changes", async () => {
    const { recording, written } = replace({ name: "Old name", format: "constructed" }, deck());

    expect(await written).toEqual({ deckId: DECK_ID });
    const update = deckUpdate(recording.queries);
    expect(update).toContain('"name" = $');
    expect(update).not.toContain("format_config");
  });

  it("clears the format config when the format changes", async () => {
    const { recording, written } = replace({ name: "Kai'Sa Aggro", format: "sealed" }, deck());

    await written;
    expect(deckUpdate(recording.queries)).toContain('"format_config" = $');
  });

  it("locks the deck row before it touches the deck's cards", async () => {
    const { recording, written } = replace({ name: "Kai'Sa Aggro", format: "constructed" }, deck());

    await written;
    expect(recording.queries[1]).toMatch(/^select .* from "decks" .* for no key update$/u);
  });

  it("writes no deck row when name and format are unchanged", async () => {
    const { recording, written } = replace({ name: "Kai'Sa Aggro", format: "constructed" }, deck());

    await written;
    expect(deckUpdate(recording.queries)).toBeUndefined();
  });
});
