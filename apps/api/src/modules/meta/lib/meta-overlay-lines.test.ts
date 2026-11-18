import { describe, expect, it } from "vitest";

import type { Repos } from "../../../deps.js";
import { toOverlayLines } from "./meta-overlay-lines.js";

function reposWith(names: Record<string, string>): Pick<Repos, "catalog"> {
  return {
    catalog: { cardNamesByIds: async () => new Map(Object.entries(names)) },
  } as unknown as Pick<Repos, "catalog">;
}

describe("toOverlayLines", () => {
  it("numbers the lines and names each card the way the catalog does", async () => {
    const lines = await toOverlayLines(reposWith({ c1: "Jinx", c2: "Vi" }), [
      { cardId: "c1", zone: "main", quantity: 3, preferredPrintingId: "p1" },
      { cardId: "c2", zone: "sideboard", quantity: 1 },
    ]);

    expect(lines).toEqual([
      {
        lineNumber: 0,
        zone: "main",
        quantity: 3,
        cardName: "Jinx",
        cardId: "c1",
        preferredPrintingId: "p1",
      },
      {
        lineNumber: 1,
        zone: "sideboard",
        quantity: 1,
        cardName: "Vi",
        cardId: "c2",
        preferredPrintingId: null,
      },
    ]);
  });

  it("refuses a card the catalog no longer has", async () => {
    await expect(
      toOverlayLines(reposWith({}), [{ cardId: "gone", zone: "main", quantity: 1 }]),
    ).rejects.toMatchObject({ status: 400 });
  });
});
