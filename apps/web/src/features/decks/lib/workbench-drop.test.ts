import { WellKnown } from "@openrift/shared/well-known";
import { beforeEach, describe, expect, it } from "vitest";

import { relaxedMoveOutcome, workbenchAddRoute } from "@/features/decks/lib/workbench-drop";
import { resetIdCounter, stubDeckBuilderCard } from "@/test/factories";

beforeEach(() => {
  resetIdCounter();
});

const { CONSTRUCTED, CUSTOM_REGION, FREEFORM } = WellKnown.deckFormat;
const { BATTLEFIELD, LEGEND, MAIN, OVERFLOW, SIDEBOARD } = WellKnown.deckZone;

function battlefields(count: number) {
  return Array.from({ length: count }, () =>
    stubDeckBuilderCard({ zone: BATTLEFIELD, cardType: "battlefield" }),
  );
}

describe("workbenchAddRoute", () => {
  const battlefield = stubDeckBuilderCard({ cardType: "battlefield" });

  it("adds a battlefield while the field has room", () => {
    expect(workbenchAddRoute(battlefield, BATTLEFIELD, battlefields(2), CONSTRUCTED)).toBe("add");
  });

  it("replaces once three battlefields are on the field", () => {
    expect(workbenchAddRoute(battlefield, BATTLEFIELD, battlefields(3), CONSTRUCTED)).toBe(
      "replace",
    );
  });

  it("replaces after one battlefield in custom-region", () => {
    expect(workbenchAddRoute(battlefield, BATTLEFIELD, battlefields(1), CUSTOM_REGION)).toBe(
      "replace",
    );
  });

  it("routes a legend placed in the legend zone through the legend switch", () => {
    const legend = stubDeckBuilderCard({ cardType: "legend" });
    expect(workbenchAddRoute(legend, LEGEND, [], CONSTRUCTED)).toBe("legend");
  });

  it("adds a plain card to the main deck", () => {
    const unit = stubDeckBuilderCard({ cardType: "unit" });
    expect(workbenchAddRoute(unit, MAIN, battlefields(3), CONSTRUCTED)).toBe("add");
  });

  it("always adds in freeform", () => {
    const legend = stubDeckBuilderCard({ cardType: "legend" });
    expect(workbenchAddRoute(legend, LEGEND, [], FREEFORM)).toBe("add");
    expect(workbenchAddRoute(battlefield, BATTLEFIELD, battlefields(3), FREEFORM)).toBe("add");
  });
});

describe("relaxedMoveOutcome", () => {
  it("reports a copy-limit break when parked copies move into the main deck", () => {
    const parked = stubDeckBuilderCard({ zone: OVERFLOW, quantity: 2 });
    const held = stubDeckBuilderCard({ cardId: parked.cardId, zone: MAIN, quantity: 2 });
    expect(
      relaxedMoveOutcome({
        card: parked,
        fromZone: OVERFLOW,
        toZone: MAIN,
        moved: 2,
        allCards: [parked, held],
        format: CONSTRUCTED,
      }),
    ).toEqual({ rule: "copyLimit", card: parked, zone: MAIN, quantity: 2, total: 4, limit: 3 });
  });

  it("reports nothing while the total stays within the limit", () => {
    const parked = stubDeckBuilderCard({ zone: OVERFLOW });
    const held = stubDeckBuilderCard({ cardId: parked.cardId, zone: MAIN, quantity: 2 });
    expect(
      relaxedMoveOutcome({
        card: parked,
        fromZone: OVERFLOW,
        toZone: MAIN,
        moved: 1,
        allCards: [parked, held],
        format: CONSTRUCTED,
      }),
    ).toBeUndefined();
  });

  it("reports nothing for moves between copy-limit zones", () => {
    const held = stubDeckBuilderCard({ zone: MAIN, quantity: 4 });
    expect(
      relaxedMoveOutcome({
        card: held,
        fromZone: MAIN,
        toZone: SIDEBOARD,
        moved: 4,
        allCards: [held],
        format: CONSTRUCTED,
      }),
    ).toBeUndefined();
  });

  it("reports nothing for moves into overflow", () => {
    const held = stubDeckBuilderCard({ zone: MAIN, quantity: 4 });
    expect(
      relaxedMoveOutcome({
        card: held,
        fromZone: MAIN,
        toZone: OVERFLOW,
        moved: 4,
        allCards: [held],
        format: CONSTRUCTED,
      }),
    ).toBeUndefined();
  });

  it("reports nothing in freeform", () => {
    const parked = stubDeckBuilderCard({ zone: OVERFLOW, quantity: 4 });
    expect(
      relaxedMoveOutcome({
        card: parked,
        fromZone: OVERFLOW,
        toZone: MAIN,
        moved: 4,
        allCards: [parked],
        format: FREEFORM,
      }),
    ).toBeUndefined();
  });
});
