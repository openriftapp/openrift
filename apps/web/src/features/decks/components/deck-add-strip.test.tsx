import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { stubPrinting } from "@/test/factories";

import { DeckAddStrip } from "./deck-add-strip";

function renderStrip(shiftHeld = false) {
  render(
    <DeckAddStrip
      printing={stubPrinting()}
      ownedCount={1}
      deckQuantity={0}
      addLabel="Add"
      addIcon
      shiftHeld={shiftHeld}
      remainingCount={3}
      onQuickAdd={vi.fn()}
    />,
  );
}

describe("DeckAddStrip", () => {
  it("labels the add button", () => {
    renderStrip();
    expect(screen.getByRole("button", { name: "Add to deck" }).textContent).toBe("Add");
  });

  it("shows the bulk count while shift is held", () => {
    renderStrip(true);
    expect(screen.getByRole("button", { name: "Add to deck" }).textContent).toBe("+3");
  });

  it("moves the owned count to the left when there is no remove button", () => {
    renderStrip();
    const ownedPill = screen.getByTitle("1 owned");
    expect(ownedPill.parentElement?.className).toContain("justify-start");
  });
});
