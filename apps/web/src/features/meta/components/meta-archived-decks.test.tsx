import type { MetaDeckSummary } from "@openrift/shared/types/api/meta";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async () => {
  const fixtures = await import("@/test/meta-event-fixtures");
  return { Link: fixtures.StubLink };
});

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ orders: { domains: ["fury"] }, labels: { domains: { fury: "Fury" } } }),
}));

const { MetaArchivedDecks } = await import("./meta-archived-decks");

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

function decks(count: number): MetaDeckSummary[] {
  return Array.from({ length: count }, (_, index) =>
    deck({ deckId: `d-${index}`, playerId: `p-${index}`, rank: index + 1 }),
  );
}

describe("MetaArchivedDecks", () => {
  it("counts the decks behind the toggle as a grouped number", () => {
    render(<MetaArchivedDecks decks={decks(8)} total={1234} subject="player" />);

    expect(screen.getByRole("button", { name: "Show all 1,234" })).toBeInTheDocument();
  });

  it("opens a wide field partly, then shows the rest on request", async () => {
    const user = userEvent.setup();
    const onShowAll = vi.fn();
    render(
      <MetaArchivedDecks decks={decks(10)} total={10} subject="player" onShowAll={onShowAll} />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(8);
    await user.click(screen.getByRole("button", { name: "Show all 10" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    expect(onShowAll).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Show fewer" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
  });

  it("offers no toggle for a field that already fits", () => {
    render(<MetaArchivedDecks decks={decks(8)} total={8} subject="player" />);

    expect(screen.queryByRole("button", { name: /Show all/u })).toBeNull();
  });

  it("says a legend's record holds nothing in scope when no deck survives it", () => {
    render(<MetaArchivedDecks decks={[]} total={0} subject="legend" />);

    expect(
      screen.getByText("No list on this legend's record falls in this scope."),
    ).toBeInTheDocument();
  });
});
