import type { MetaDeckSummary } from "@openrift/shared/types/api/meta";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async () => {
  const fixtures = await import("@/test/meta-event-fixtures");
  return { Link: fixtures.StubLink };
});

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ orders: { domains: ["fury"] }, labels: { domains: { fury: "Fury" } } }),
}));

const { MetaPlayerDeckTile } = await import("./meta-player-deck-tile");

function deck(overrides: Partial<MetaDeckSummary> = {}): MetaDeckSummary {
  return {
    playerId: "p-1",
    deckId: "d-1",
    shareToken: "tok-1",
    listStatus: "full",
    name: "Ornn",
    format: "constructed",
    legendCardId: "card-ornn",
    legendName: "Ornn, Fire Below the Mountain",
    legendSlug: "fire-below-the-mountain",
    legendArchiveSlug: "ornn-fire-below-the-mountain",
    legendImageId: null,
    championCardId: null,
    championName: null,
    championImageId: null,
    playerName: "Ana",
    playerKey: "u1001",
    rank: 1,
    rankIsTier: false,
    wins: 9,
    losses: 1,
    draws: 1,
    event: {
      slug: "summoner-skirmish",
      name: "Summoner Skirmish",
      eventDate: "2026-08-26",
      format: "constructed",
      tier: "premier",
      country: "ES",
    },
    ...overrides,
  };
}

describe("MetaPlayerDeckTile", () => {
  it("leads with the finish and names the winner", () => {
    render(<MetaPlayerDeckTile deck={deck()} />);

    expect(screen.getByText("1st")).toBeInTheDocument();
    expect(screen.getByText("Winner")).toBeInTheDocument();
  });

  it("prints a finish past the podium as an ordinal without a label", () => {
    render(<MetaPlayerDeckTile deck={deck({ rank: 12 })} />);

    expect(screen.getByText("12th")).toBeInTheDocument();
    expect(screen.queryByText("Winner")).toBeNull();
  });

  it("links the legend, the event and the decklist", () => {
    render(<MetaPlayerDeckTile deck={deck()} />);

    expect(screen.getByRole("link", { name: "Ornn" })).toHaveAttribute(
      "href",
      "/meta/legends/ornn-fire-below-the-mountain",
    );
    expect(screen.getByRole("link", { name: "Summoner Skirmish" })).toHaveAttribute(
      "href",
      "/meta/summoner-skirmish",
    );
    expect(screen.getByRole("link", { name: "Deck" })).toHaveAttribute("href", "/meta/decks/tok-1");
  });

  it("draws the legend's domain runes when the page knows them", () => {
    render(<MetaPlayerDeckTile deck={deck()} legendDomains={["fury"]} />);

    expect(screen.getByRole("img", { name: "Fury" })).toBeInTheDocument();
  });

  it("prints the record beside the event day", () => {
    render(<MetaPlayerDeckTile deck={deck()} />);

    expect(screen.getByText(/^9-1-1 · /u)).toBeInTheDocument();
  });
});
