import { describe, expect, it, vi } from "vitest";

import type { StoredInference } from "../repositories/meta-inferences.js";
import { inferMetaDeckSlots, isInferSlotsNoop } from "./meta-infer-slots.js";

const LEGEND = "legend";
const YI = "yi";
const BATTLEFIELDS = ["bf-1", "bf-2", "bf-3"];

function cardRows(
  deckId: string,
  listStatus: "full" | "partial",
  zones: { champion?: string; battlefields?: readonly string[] },
) {
  return [
    { deckId, listStatus, cardId: "charm", zone: "main", quantity: 3 },
    { deckId, listStatus, cardId: "defy", zone: "main", quantity: 3 },
    ...(zones.champion === undefined
      ? []
      : [{ deckId, listStatus, cardId: zones.champion, zone: "champion", quantity: 1 }]),
    ...(zones.battlefields ?? []).map((cardId) => ({
      deckId,
      listStatus,
      cardId,
      zone: "battlefield",
      quantity: 1,
    })),
  ];
}

const ROWS = [
  ...cardRows("k1", "full", { champion: YI, battlefields: BATTLEFIELDS }),
  ...cardRows("k2", "full", { champion: YI, battlefields: BATTLEFIELDS }),
  ...cardRows("k3", "full", { champion: YI, battlefields: BATTLEFIELDS }),
  ...cardRows("t", "partial", {}),
];

function repos(stored: StoredInference[]) {
  const metaInferences = {
    championFacts: vi.fn().mockResolvedValue([
      { id: LEGEND, tags: ["Master Yi"], keywords: [], maxCopiesOverride: null, isChampion: false },
      { id: YI, tags: ["Master Yi"], keywords: [], maxCopiesOverride: null, isChampion: true },
    ]),
    inferenceGroups: vi.fn().mockResolvedValue([{ legendCardId: LEGEND, format: "constructed" }]),
    inferenceDecks: vi.fn().mockResolvedValue(ROWS),
    storedInferences: vi.fn().mockResolvedValue(stored),
    replaceInferences: vi.fn().mockResolvedValue(undefined),
  };
  return { metaInferences, repos: { metaInferences } as never };
}

async function planned(): Promise<StoredInference> {
  const { metaInferences, repos: deps } = repos([]);
  await inferMetaDeckSlots(deps);
  const [written] = metaInferences.replaceInferences.mock.calls[0] as [StoredInference[]];
  return written[0]!;
}

describe("inferMetaDeckSlots", () => {
  it("writes a guess for the partial list and nothing for the full ones", async () => {
    const { metaInferences, repos: deps } = repos([]);

    const result = await inferMetaDeckSlots(deps);

    const [written, removed] = metaInferences.replaceInferences.mock.calls[0] as [
      StoredInference[],
      string[],
    ];
    expect(written.map((row) => [row.deckId, row.championCardId])).toEqual([["t", YI]]);
    expect(written[0]?.battlefieldCardId).toBe("bf-1");
    expect(removed).toEqual([]);
    expect(result).toEqual({ groups: 1, guessed: 1, written: 1, removed: 0 });
  });

  it("skips the write when the stored guess is unchanged", async () => {
    const { metaInferences, repos: deps } = repos([await planned()]);

    const result = await inferMetaDeckSlots(deps);

    expect(metaInferences.replaceInferences).not.toHaveBeenCalled();
    expect(isInferSlotsNoop(result)).toBe(true);
  });

  it("rewrites a guess whose neighbours changed", async () => {
    const stale = { ...(await planned()), neighbours: [] };
    const { metaInferences, repos: deps } = repos([stale]);

    const result = await inferMetaDeckSlots(deps);

    expect(result.written).toBe(1);
    expect(metaInferences.replaceInferences).toHaveBeenCalledWith(
      [expect.objectContaining({ deckId: "t" })],
      [],
    );
  });

  it("removes a stored guess for a list that no longer gets one", async () => {
    const gone: StoredInference = {
      deckId: "gone",
      championCardId: YI,
      championAltCardId: null,
      championUnsure: false,
      battlefieldCardId: null,
      battlefieldAlsoCardIds: [],
      neighbours: [],
    };
    const { metaInferences, repos: deps } = repos([await planned(), gone]);

    const result = await inferMetaDeckSlots(deps);

    expect(metaInferences.replaceInferences).toHaveBeenCalledWith([], ["gone"]);
    expect(result).toMatchObject({ written: 0, removed: 1 });
  });
});
