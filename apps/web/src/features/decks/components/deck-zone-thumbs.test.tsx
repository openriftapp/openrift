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

describe("ZoneThumb per-copy band", () => {
  const band = { exact: 2, other: 1, borrowed: 0, locked: 0, missing: 0 };

  function renderCopy(showsCopyPrinting: boolean) {
    render(
      <ZoneThumb
        deckId="deck-1"
        card={stubDeckBuilderCard({ cardName: "Rengar", quantity: 3 })}
        band={band}
        copyIndex={2}
        showsCopyPrinting={showsCopyPrinting}
        zone="main"
        thumbnail="https://example.test/rengar.webp"
        isLandscape={false}
        readOnly
      />,
    );
  }

  it("labels an other-printing copy as such while it shows the entry's art", () => {
    renderCopy(false);
    expect(screen.getByText("Other printing")).toBeDefined();
  });

  it("labels the copy owned once it shows its own printing", () => {
    renderCopy(true);
    expect(screen.getByText("Owned")).toBeDefined();
    expect(screen.queryByText("Other printing")).toBeNull();
  });
});
