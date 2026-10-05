import { describe, expect, it } from "vitest";

import type { MetaOverlayCardRow } from "../repositories/meta-overlays.js";
import { toMetaIgnoredEntry, toMetaOverlayCardRows } from "./meta-overlay-presenters.js";

function card(overrides: Partial<MetaOverlayCardRow> = {}): MetaOverlayCardRow {
  return {
    overlayId: "overlay-1",
    lineNumber: 1,
    zone: "main",
    quantity: 3,
    cardName: "Jinx, Loose Cannon",
    cardId: "card-1",
    preferredPrintingId: "printing-1",
    ...overrides,
  };
}

describe("toMetaOverlayCardRows", () => {
  it("keeps the reviewed fields and drops the overlay and printing ids", () => {
    expect(toMetaOverlayCardRows([card()])).toEqual([
      {
        lineNumber: 1,
        zone: "main",
        quantity: 3,
        cardName: "Jinx, Loose Cannon",
        cardId: "card-1",
      },
    ]);
  });

  it("keeps an unresolved card's null id", () => {
    expect(toMetaOverlayCardRows([card({ cardId: null })])[0]?.cardId).toBeNull();
  });

  it("returns an empty list for no cards", () => {
    expect(toMetaOverlayCardRows([])).toEqual([]);
  });
});

describe("toMetaIgnoredEntry", () => {
  it("serializes createdAt and keeps the other fields", () => {
    expect(
      toMetaIgnoredEntry({
        provider: "uvsgames",
        externalId: "4821",
        createdAt: new Date("2026-08-15T18:00:00Z"),
      }),
    ).toEqual({ provider: "uvsgames", externalId: "4821", createdAt: "2026-08-15T18:00:00.000Z" });
  });
});
