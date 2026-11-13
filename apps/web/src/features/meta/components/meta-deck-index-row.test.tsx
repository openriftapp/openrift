import type { MetaDeckSummary } from "@openrift/shared/types/api/meta";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    ...rest
  }: {
    children?: React.ReactNode;
    to?: string;
    params?: Record<string, string>;
  }) => (
    <a
      {...rest}
      href={Object.entries(params ?? {}).reduce(
        (href, [key, value]) => href.replace(`$${key}`, value),
        to ?? "/",
      )}
    >
      {children}
    </a>
  ),
}));

import { MetaDeckIndexRow } from "./meta-deck-index-row";

function deck(overrides: Partial<MetaDeckSummary> = {}): MetaDeckSummary {
  return {
    playerId: "player-1",
    deckId: "deck-1",
    shareToken: "aB3dE5gH7jK9",
    listStatus: "full",
    name: "Ornn Ramp",
    format: "constructed",
    legendCardId: "card-ornn",
    legendName: "Ornn, Fire Below the Mountain",
    legendCharacter: "Ornn",
    legendEpithet: "Fire Below the Mountain",
    legendSlug: "ornn",
    legendArchiveSlug: "ornn-fire-below-the-mountain",
    legendImageId: "img-ornn",
    championCardId: "card-ornn-champ",
    championName: "Ornn, Blacksmith",
    championImageId: "img-ornn-champ",
    inferredChampionNames: [],
    inferredChampionImageId: null,
    listShape: null,
    playerName: "MICE TheManland",
    playerKey: "u1",
    rank: 1,
    rankIsTier: false,
    wins: 14,
    losses: 1,
    draws: 1,
    event: {
      slug: "rq-barcelona",
      name: "Regional Qualifier Barcelona",
      eventDate: "2026-08-26",
      format: "constructed",
      tier: "premier",
      country: "ES",
    },
    ...overrides,
  };
}

const seen = (text: string) => screen.queryAllByText(text).length > 0;

describe("MetaDeckIndexRow", () => {
  it("reads the finish against the field it came out of", () => {
    render(<MetaDeckIndexRow deck={deck()} fieldSize={2224} marketplace="cardtrader" />);
    expect(seen("of 2,224")).toBe(true);
    expect(seen("14-1-1")).toBe(true);
  });

  it("prints an ordinal below the medals and no field when the size is unknown", () => {
    render(
      <MetaDeckIndexRow deck={deck({ rank: 25 })} fieldSize={null} marketplace="cardtrader" />,
    );
    expect(seen("25th")).toBe(true);
    expect(screen.queryAllByText(/^of /u)).toHaveLength(0);
  });

  it("keeps every column in its place for a deck that names no legend", () => {
    const { container } = render(
      <MetaDeckIndexRow
        deck={deck({ legendName: null, legendArchiveSlug: null })}
        fieldSize={2224}
        marketplace="cardtrader"
      />,
    );

    const grid = container.querySelector(String.raw`.sm\:grid`) as HTMLElement;
    expect(grid.children).toHaveLength(8);
  });

  it("leaves the event, the date and the field to the group header when grouped", () => {
    const { container } = render(
      <MetaDeckIndexRow deck={deck()} fieldSize={2224} marketplace="cardtrader" grouped />,
    );

    const grid = container.querySelector(String.raw`.sm\:grid`) as HTMLElement;
    expect(grid.children).toHaveLength(6);
    expect(seen("Regional Qualifier Barcelona")).toBe(false);
    expect(seen("of 2,224")).toBe(false);
  });

  it("notes the unpriced cards beside the value and the cost to complete", () => {
    render(
      <MetaDeckIndexRow
        deck={deck()}
        fieldSize={2224}
        marketplace="cardtrader"
        cost={{
          needed: 40,
          owned: 20,
          value: 142,
          toComplete: 30,
          unpriced: 3,
          unpricedMissing: 2,
        }}
      />,
    );
    expect(screen.queryAllByText("€142 (3 unpriced)").length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/to complete \(2 unpriced\)/u).length).toBeGreaterThan(0);
  });

  it("drops the to-complete cell without a collection, in both layouts", () => {
    const { container, rerender } = render(
      <MetaDeckIndexRow
        deck={deck()}
        fieldSize={2224}
        marketplace="cardtrader"
        withCollection={false}
        cost={{
          needed: 40,
          owned: undefined,
          value: 142,
          toComplete: undefined,
          unpriced: 0,
          unpricedMissing: 0,
        }}
      />,
    );
    const grid = () => container.querySelector(String.raw`.sm\:grid`) as HTMLElement;
    expect(grid().children).toHaveLength(7);
    expect(grid().className).not.toContain("10.5rem");
    expect(seen("€142")).toBe(true);

    rerender(
      <MetaDeckIndexRow
        deck={deck()}
        fieldSize={2224}
        marketplace="cardtrader"
        withCollection={false}
        grouped
      />,
    );
    expect(grid().children).toHaveLength(5);
    expect(grid().className).not.toContain("10.5rem");
  });

  it("links the whole row to the list and the legend to its archive page", () => {
    render(<MetaDeckIndexRow deck={deck()} fieldSize={2224} marketplace="cardtrader" />);
    expect(
      screen.getByRole("link", {
        name: "MICE TheManland's Ornn, Fire Below the Mountain decklist",
      }),
    ).toHaveAttribute("href", "/meta/decks/aB3dE5gH7jK9");
    expect(screen.getAllByRole("link", { name: "Ornn" })[0]).toHaveAttribute(
      "href",
      "/meta/legends/ornn-fire-below-the-mountain",
    );
  });

  it("shows what the list is worth and what completing it costs", () => {
    render(
      <MetaDeckIndexRow
        deck={deck()}
        fieldSize={2224}
        marketplace="cardtrader"
        cost={{
          needed: 40,
          owned: 36,
          value: 142,
          toComplete: 18,
          unpriced: 0,
          unpricedMissing: 0,
        }}
      />,
    );
    expect(seen("€142")).toBe(true);
    expect(seen("36/40 owned")).toBe(true);
    expect(seen("€18")).toBe(true);
  });

  it("calls a completed list buildable", () => {
    render(
      <MetaDeckIndexRow
        deck={deck()}
        fieldSize={2224}
        marketplace="cardtrader"
        cost={{ needed: 40, owned: 40, value: 142, toComplete: 0, unpriced: 0, unpricedMissing: 0 }}
      />,
    );
    expect(seen("Buildable")).toBe(true);
    expect(seen("All 40 owned")).toBe(true);
  });

  it("marks a partial list", () => {
    render(
      <MetaDeckIndexRow
        deck={deck({ listStatus: "partial" })}
        fieldSize={2224}
        marketplace="cardtrader"
      />,
    );
    expect(seen("Partial list")).toBe(true);
  });
});
