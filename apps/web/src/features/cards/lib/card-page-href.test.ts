import type { RegisteredRouter } from "@tanstack/react-router";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { cardPageHref } from "@/features/cards/lib/card-page-href";
import { stubPrinting } from "@/test/factories";

function makeRouter() {
  const rootRoute = createRootRoute();
  const cardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/cards/$cardSlug/{-$printingSlug}",
  });
  return createRouter({
    routeTree: rootRoute.addChildren([cardRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  }) as unknown as RegisteredRouter;
}

describe("cardPageHref", () => {
  it("links the card page to the printing by id", () => {
    const printing = stubPrinting({ printingId: "printing-1", card: { slug: "annie-fiery" } });
    expect(cardPageHref(makeRouter(), printing)).toBe("/cards/annie-fiery?printingId=printing-1");
  });

  it("adds side=2 for the back of a printing showing the same card on both sides", () => {
    const printing = stubPrinting({
      printingId: "printing-1",
      cardId: "card-1",
      side: 2,
      card: { slug: "annie-fiery" },
      otherSide: {
        faceId: "face-1",
        cardId: "card-1",
        cardName: "Annie, Fiery",
        cardSlug: "annie-fiery",
        shortCode: "OGN-001",
      },
    });
    expect(cardPageHref(makeRouter(), printing)).toBe(
      "/cards/annie-fiery?printingId=printing-1&side=2",
    );
  });

  it("leaves the side off the back of a printing whose other side is a different card", () => {
    const printing = stubPrinting({
      printingId: "printing-1",
      cardId: "card-2",
      side: 2,
      card: { slug: "jinx-rebel" },
      otherSide: {
        faceId: "face-1",
        cardId: "card-1",
        cardName: "Annie, Fiery",
        cardSlug: "annie-fiery",
        shortCode: "OGN-001",
      },
    });
    expect(cardPageHref(makeRouter(), printing)).toBe("/cards/jinx-rebel?printingId=printing-1");
  });
});
