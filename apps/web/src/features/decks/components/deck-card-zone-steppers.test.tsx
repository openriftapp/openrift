import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getDeckCardKey } from "@/features/decks/lib/deck-builder-card";
import { stubDeckBuilderCard } from "@/test/factories";

import { DeckCardZoneSteppers } from "./deck-card-zone-steppers";

const buccaneer = stubDeckBuilderCard({ cardName: "Brazen Buccaneer", zone: "main", quantity: 3 });

describe("DeckCardZoneSteppers", () => {
  it("adds and removes copies in the row's zone", () => {
    const onAdd = vi.fn();
    const onRemove = vi.fn();
    render(
      <DeckCardZoneSteppers
        entries={[buccaneer]}
        isFreeform={false}
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
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        printingLabels={
          new Map([
            [getDeckCardKey(plain), "Standard"],
            [getDeckCardKey(foil), "Foil"],
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
      <DeckCardZoneSteppers entries={[]} isFreeform={false} onAdd={vi.fn()} onRemove={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
