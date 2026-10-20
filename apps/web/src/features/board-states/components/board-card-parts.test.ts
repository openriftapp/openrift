import { describe, expect, it } from "vitest";

import { stubPrinting } from "@/test/factories";

import { cardImageId } from "./board-card-parts";

describe("cardImageId", () => {
  it("shows the side of a double-sided printing that carries the placed card", () => {
    const bird = stubPrinting({
      printingId: "pair",
      side: 1,
      cardId: "bird",
      images: [{ imageId: "img-bird" }],
    });
    const gold = stubPrinting({
      printingId: "pair",
      side: 2,
      cardId: "gold",
      images: [{ imageId: "img-gold" }],
    });
    const catalog = {
      printingsById: { pair: bird },
      printingsByCardId: new Map([
        ["bird", [bird]],
        ["gold", [gold]],
      ]),
    } as never;

    expect(cardImageId({ cardId: "gold", printingId: "pair" } as never, catalog)).toBe("img-gold");
  });
});
