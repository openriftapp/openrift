import { describe, expect, it } from "vitest";

import { toCardBanResponse } from "./card-ban-presenters.js";

describe("toCardBanResponse", () => {
  it("maps a ban row and serializes createdAt", () => {
    expect(
      toCardBanResponse({
        id: "ban-1",
        cardId: "card-1",
        formatId: "standard",
        formatName: "Standard",
        bannedAt: "2026-01-15",
        reason: null,
        createdAt: new Date("2026-01-15T10:00:00.000Z"),
      }),
    ).toEqual({
      id: "ban-1",
      cardId: "card-1",
      formatId: "standard",
      formatName: "Standard",
      bannedAt: "2026-01-15",
      reason: null,
      createdAt: "2026-01-15T10:00:00.000Z",
    });
  });
});
