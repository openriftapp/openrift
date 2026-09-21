import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { stubDeckBuilderCard } from "@/test/factories";

import { ZoneThumb } from "./deck-zone-thumbs";

function renderThumb(banned: boolean) {
  render(
    <ZoneThumb
      deckId="deck-1"
      card={stubDeckBuilderCard({ cardName: "Stacked Deck", banned })}
      zone="main"
      thumbnail="https://example.test/stacked-deck.webp"
      isLandscape={false}
      readOnly
    />,
  );
}

describe("ZoneThumb", () => {
  it("marks a banned card with the corner ribbon", () => {
    renderThumb(true);
    expect(screen.getByText("Banned")).toBeDefined();
  });

  it("draws no ribbon on a legal card", () => {
    renderThumb(false);
    expect(screen.queryByText("Banned")).toBeNull();
  });
});
