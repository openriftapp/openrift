import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Repos } from "../../../deps.js";
import type { CardNameIndex } from "../../../lib/card-names.js";
import { applyPlayerOverlays } from "./meta-promote-overlays.js";
import type { MetaPromoteResult } from "./meta-promote-shared.js";

vi.mock("../../candidates/services/candidate-links.js", () => ({
  resolveCardIdByName: vi.fn(() => null),
}));

const EVENT_ID = "e0000000-0001-4000-a000-000000000001";
const LEGEND_ID = "a0000000-0001-4000-a000-000000000001";
const SPELL_ID = "a0000000-0002-4000-a000-000000000002";
const FIELD = 256;

function playerId(index: number): string {
  return `f0000000-0000-4000-a000-${String(index).padStart(12, "0")}`;
}

function overlayId(index: number): string {
  return `c0000000-0000-4000-a000-${String(index).padStart(12, "0")}`;
}

function standing(index: number) {
  return {
    id: playerId(index),
    playerName: `Summoner ${index}`,
    uvsgamesPlayerId: null,
    rank: index + 1,
    rankIsTier: false,
    wins: 3,
    losses: 1,
    draws: 0,
    matchPoints: null,
    opponentMatchWinPct: null,
    gameWinPct: null,
    opponentGameWinPct: null,
    entryStatus: null,
    legendCardId: LEGEND_ID,
    championCardId: null,
  };
}

function listOverlay(index: number) {
  return {
    id: overlayId(index),
    metaEventPlayerId: playerId(index),
    metaEventId: null,
    eventOverlayId: null,
    claimedFields: ["listStatus", "cards"],
    listStatus: "full",
    playerName: null,
    rank: null,
    rankIsTier: null,
    wins: null,
    losses: null,
    draws: null,
    matchPoints: null,
    opponentMatchWinPct: null,
    gameWinPct: null,
    opponentGameWinPct: null,
    entryStatus: null,
    legendCardId: null,
    championCardId: null,
  };
}

const LINES = [
  {
    overlayId: "",
    lineNumber: 0,
    zone: "legend",
    quantity: 1,
    cardName: "Legend",
    cardId: LEGEND_ID,
    preferredPrintingId: null,
  },
  {
    overlayId: "",
    lineNumber: 1,
    zone: "main",
    quantity: 3,
    cardName: "Spell",
    cardId: SPELL_ID,
    preferredPrintingId: null,
  },
];

const metaOverlays = {
  acceptedPlayerOverlays: vi.fn(),
  playerOverlayById: vi.fn(),
  cardsByOverlayIds: vi.fn(),
  linkPlayerOverlay: vi.fn(),
  linkPlayerOverlays: vi.fn(),
};

const meta = {
  standingsNamesForEvent: vi.fn(),
  rawStandingsForEvent: vi.fn(),
  deckStatesForEvent: vi.fn(),
  updatePlayer: vi.fn(),
  updatePlayers: vi.fn(),
  clearPlayerDeck: vi.fn(),
  playerById: vi.fn(),
  setPlayerDeck: vi.fn(),
  createPlayer: vi.fn(),
};

const repos = { metaOverlays, meta } as unknown as Repos;

function repoCalls(): number {
  return [...Object.values(metaOverlays), ...Object.values(meta)].reduce(
    (sum, fn) => sum + fn.mock.calls.length,
    0,
  );
}

function emptyResult(): MetaPromoteResult {
  return { errors: [], players: 0 } as unknown as MetaPromoteResult;
}

beforeEach(() => {
  vi.clearAllMocks();
  const overlays = Array.from({ length: FIELD }, (_, index) => listOverlay(index));
  metaOverlays.acceptedPlayerOverlays.mockResolvedValue(overlays);
  metaOverlays.playerOverlayById.mockImplementation((id: string) =>
    Promise.resolve({
      ...overlays.find((overlay) => overlay.id === id),
      cards: LINES.map((line) => ({ ...line, overlayId: id })),
    }),
  );
  metaOverlays.cardsByOverlayIds.mockImplementation((ids: string[]) =>
    Promise.resolve(
      new Map(ids.map((id) => [id, LINES.map((line) => ({ ...line, overlayId: id }))])),
    ),
  );
  meta.standingsNamesForEvent.mockResolvedValue([]);
  meta.rawStandingsForEvent.mockResolvedValue(
    Array.from({ length: FIELD }, (_, index) => standing(index)),
  );
  meta.deckStatesForEvent.mockResolvedValue(
    new Map(
      Array.from({ length: FIELD }, (_, index) => [
        playerId(index),
        {
          deckId: `d-${index}`,
          listStatus: "full",
          name: `Deck ${index}`,
          format: "constructed",
          cards: [
            { cardId: LEGEND_ID, zone: "legend", quantity: 1, preferredPrintingId: null },
            { cardId: SPELL_ID, zone: "main", quantity: 3, preferredPrintingId: null },
          ],
        },
      ]),
    ),
  );
  meta.playerById.mockImplementation((id: string) =>
    Promise.resolve({ id, deckName: "Deck", legendName: "Legend", playerName: "Summoner" }),
  );
  meta.setPlayerDeck.mockResolvedValue({ deckId: "d" });
  meta.updatePlayer.mockResolvedValue(true);
});

describe("applyPlayerOverlays", () => {
  it("re-applies a full field of unchanged lists in a fixed number of repository calls", async () => {
    await applyPlayerOverlays(repos, EVENT_ID, "constructed", emptyResult(), {} as CardNameIndex);

    expect(repoCalls()).toBeLessThan(10);
    expect(meta.setPlayerDeck).not.toHaveBeenCalled();
  });

  it("writes only the lists that differ from the stored deck", async () => {
    const states = await meta.deckStatesForEvent();
    states.get(playerId(7)).cards = [];
    meta.deckStatesForEvent.mockResolvedValue(states);

    await applyPlayerOverlays(repos, EVENT_ID, "constructed", emptyResult(), {} as CardNameIndex);

    expect(meta.setPlayerDeck).toHaveBeenCalledTimes(1);
    expect(meta.setPlayerDeck.mock.calls[0]![0]).toBe(playerId(7));
    expect(meta.setPlayerDeck.mock.calls[0]![1]).toMatchObject({
      name: "Deck 7",
      format: "constructed",
      listStatus: "full",
    });
  });

  it("writes the standings columns an overlay changes, in one batch", async () => {
    const overlays = await metaOverlays.acceptedPlayerOverlays();
    overlays[3] = { ...overlays[3], claimedFields: ["wins"], wins: 4 };
    metaOverlays.acceptedPlayerOverlays.mockResolvedValue(overlays);

    await applyPlayerOverlays(repos, EVENT_ID, "constructed", emptyResult(), {} as CardNameIndex);

    expect(meta.updatePlayers).toHaveBeenCalledTimes(1);
    expect(meta.updatePlayers.mock.calls[0]![0]).toEqual([
      expect.objectContaining({ id: playerId(3), wins: 4 }),
    ]);
  });
});
