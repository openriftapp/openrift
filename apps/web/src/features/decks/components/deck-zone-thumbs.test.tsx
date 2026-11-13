import type { Card, CardBan } from "@openrift/shared/types/catalog";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { m } from "@/paraglide/messages.js";
import { stubCard, stubDeckBuilderCard } from "@/test/factories";

import { ZoneThumb } from "./deck-zone-thumbs";

const { cardsById } = vi.hoisted(() => ({ cardsById: {} as Record<string, Card> }));
vi.mock("@/features/cards/hooks/use-cards", () => ({ useCards: () => ({ cardsById }) }));

function ban(formatId: string, formatName: string): CardBan {
  return { formatId, formatName, bannedAt: "2026-11-23", reason: null };
}

function renderThumb(bans: { bans?: CardBan[]; upcomingBans?: CardBan[] } = {}) {
  const card = stubDeckBuilderCard({ cardName: "Stacked Deck" });
  cardsById[card.cardId] = stubCard({ bans: [], upcomingBans: [], ...bans });
  render(
    <ZoneThumb
      deckId="deck-1"
      card={card}
      zone="main"
      thumbnail="https://example.test/stacked-deck.webp"
      isLandscape={false}
      readOnly
    />,
  );
}

describe("ZoneThumb", () => {
  it("marks a banned card with the corner ribbon", () => {
    renderThumb({ bans: [ban("standard", "Standard")] });
    expect(screen.getByText("Banned")).toBeDefined();
  });

  it("names the format of a sole mode ban", () => {
    renderThumb({ bans: [ban("2v2", "2v2")] });
    expect(screen.getByText(m.cards_thumb_format_ban({ format: "2v2" }))).toBeDefined();
  });

  it("flags a scheduled ban", () => {
    renderThumb({ upcomingBans: [ban("standard", "Standard")] });
    expect(screen.getByText(m.cards_thumb_ban_upcoming())).toBeDefined();
  });

  it("draws no ribbon on a legal card", () => {
    renderThumb();
    expect(screen.queryByText("Banned")).toBeNull();
    expect(screen.queryByText(m.cards_thumb_ban_upcoming())).toBeNull();
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
