import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { deckCardKey } from "@/features/decks/lib/deck-builder-card";
import type * as UseEnums from "@/hooks/use-enums";
import { stubDeckBuilderCard } from "@/test/factories";

import { DeckCardZoneSteppers } from "./deck-card-zone-steppers";

vi.mock("@/hooks/use-enums", async (importOriginal) => {
  const actual = await importOriginal<typeof UseEnums>();
  const { useZoneOrderStub } = await import("@/test/zone-order-stub");
  return { ...actual, useZoneOrder: useZoneOrderStub };
});

const buccaneer = stubDeckBuilderCard({ cardName: "Brazen Buccaneer", zone: "main", quantity: 3 });

describe("DeckCardZoneSteppers", () => {
  it("adds and removes copies in the row's zone", () => {
    const onAdd = vi.fn();
    const onRemove = vi.fn();
    render(
      <DeckCardZoneSteppers
        entries={[buccaneer]}
        isFreeform={false}
        canIncrement={() => true}
        onAdd={onAdd}
        onRemove={onRemove}
      />,
    );
    expect(screen.getByText("Main Deck")).toBeDefined();
    expect(screen.getByText("3×")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Add one copy of Brazen Buccaneer" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove one copy of Brazen Buccaneer" }));

    expect(onAdd).toHaveBeenCalledWith(buccaneer);
    expect(onRemove).toHaveBeenCalledWith(buccaneer);
  });

  it("names the printing of each entry that shares its zone", () => {
    const plain = stubDeckBuilderCard({ cardId: "rampage", cardName: "Rampage", quantity: 1 });
    const foil = stubDeckBuilderCard({
      cardId: "rampage",
      cardName: "Rampage",
      quantity: 1,
      preferredPrintingId: "rampage-foil",
    });
    render(
      <DeckCardZoneSteppers
        entries={[plain, foil]}
        isFreeform={false}
        canIncrement={() => true}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        printingLabels={
          new Map([
            [deckCardKey(plain), "Standard"],
            [deckCardKey(foil), "Foil"],
          ])
        }
      />,
    );
    expect(screen.getByText("· Standard")).toBeDefined();
    expect(screen.getByText("· Foil")).toBeDefined();
  });

  it("offers no extra copy in a one-copy zone", () => {
    render(
      <DeckCardZoneSteppers
        entries={[stubDeckBuilderCard({ cardName: "Jinx", zone: "legend", quantity: 1 })]}
        isFreeform={false}
        canIncrement={() => true}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Add one copy of Jinx" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("renders nothing when the card is not in the deck", () => {
    const { container } = render(
      <DeckCardZoneSteppers
        entries={[]}
        isFreeform={false}
        canIncrement={() => true}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("disables the plus button when the deck has no room for another copy", () => {
    const runes = stubDeckBuilderCard({ cardName: "Fury Rune", zone: "runes", quantity: 12 });
    render(
      <DeckCardZoneSteppers
        entries={[runes]}
        isFreeform={false}
        canIncrement={() => false}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Add one copy of Fury Rune" }).hasAttribute("disabled"),
    ).toBe(true);
  });
});
