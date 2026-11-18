import { describe, expect, it } from "vitest";

import { playerOverlayFieldsSchema } from "./meta-overlays.js";
import { createMetaPlayerSchema, metaDeckCardSchema } from "./meta-players.js";

function issuePaths(result: { error?: { issues: { path: PropertyKey[] }[] } }) {
  return result.error?.issues.map((issue) => issue.path.join("."));
}

describe("playerOverlayFieldsSchema bounds", () => {
  it("rejects a record count above the smallint range", () => {
    expect(issuePaths(playerOverlayFieldsSchema.safeParse({ wins: 32_768 }))).toEqual(["wins"]);
    expect(issuePaths(playerOverlayFieldsSchema.safeParse({ losses: 32_768 }))).toEqual(["losses"]);
    expect(issuePaths(playerOverlayFieldsSchema.safeParse({ draws: 32_768 }))).toEqual(["draws"]);
  });

  it("rejects match points above the integer range", () => {
    expect(issuePaths(playerOverlayFieldsSchema.safeParse({ matchPoints: 2_147_483_648 }))).toEqual(
      ["matchPoints"],
    );
  });

  it("accepts the largest values the columns hold", () => {
    expect(
      playerOverlayFieldsSchema.safeParse({ wins: 32_767, matchPoints: 2_147_483_647 }).success,
    ).toBe(true);
  });
});

describe("createMetaPlayerSchema bounds", () => {
  const base = { eventId: "019a0000-0000-7000-8000-000000000001", playerName: "Ashe", rank: 1 };

  it("rejects a record count above the smallint range", () => {
    expect(issuePaths(createMetaPlayerSchema.safeParse({ ...base, wins: 32_768 }))).toEqual([
      "wins",
    ]);
    expect(issuePaths(createMetaPlayerSchema.safeParse({ ...base, draws: 32_768 }))).toEqual([
      "draws",
    ]);
  });

  it("accepts the smallint maximum", () => {
    expect(createMetaPlayerSchema.safeParse({ ...base, losses: 32_767 }).success).toBe(true);
  });
});

describe("metaDeckCardSchema bounds", () => {
  const card = { cardId: "019a0000-0000-7000-8000-000000000002", zone: "main" };

  it("rejects a quantity above the deck card limit", () => {
    expect(issuePaths(metaDeckCardSchema.safeParse({ ...card, quantity: 100 }))).toEqual([
      "quantity",
    ]);
  });

  it("accepts the deck card limit", () => {
    expect(metaDeckCardSchema.safeParse({ ...card, quantity: 99 }).success).toBe(true);
  });
});
