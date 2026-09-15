import type {
  MetaEventMatch,
  MetaEventPhase,
  MetaEventPlayer,
} from "@openrift/shared/types/api/meta";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { metaMatch, metaPhase, metaPlayer } from "@/test/meta-event-fixtures";

vi.mock("@tanstack/react-router", async () => {
  const fixtures = await import("@/test/meta-event-fixtures");
  return { Link: fixtures.StubLink };
});

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ orders: { domains: ["fury"] }, labels: { domains: { fury: "Fury" } } }),
}));

vi.mock("@/hooks/use-domain-colors", () => ({ useDomainColors: () => ({}) }));

const { MetaEventLegendFinishes } = await import("./meta-event-legend-finishes");

const YASUO = metaPlayer().legend;

function legend(cardId: string, name: string): MetaEventPlayer["legend"] {
  return { ...YASUO!, cardId, name, slug: cardId, archiveSlug: cardId };
}

function tiles(): HTMLElement[] {
  return screen.getAllByRole("listitem");
}

function renderFinishes(
  players: MetaEventPlayer[],
  matches: MetaEventMatch[] = [],
  phases: MetaEventPhase[] = [],
) {
  render(
    <MetaEventLegendFinishes
      players={players}
      matches={matches}
      phases={phases}
      slug="summoner-skirmish"
    />,
  );
}

function field(
  names: string[],
  overrides: (index: number) => Partial<MetaEventPlayer> = () => ({}),
) {
  return names.map((name, index) =>
    metaPlayer({
      id: `p-${index}`,
      playerName: `Player ${index}`,
      playerKey: `u${index}`,
      rank: index + 1,
      legend: legend(`card-${name}`, name),
      ...overrides(index),
    }),
  );
}

describe("MetaEventLegendFinishes", () => {
  it("renders nothing for a field whose entries name no legend", () => {
    const { container } = render(
      <MetaEventLegendFinishes
        players={[metaPlayer({ id: "p-1", legend: null }), metaPlayer({ id: "p-2", legend: null })]}
        matches={[]}
        phases={[]}
        slug="summoner-skirmish"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("names one tile per legend, keeping the best-placed pilot of each", () => {
    renderFinishes([
      metaPlayer({ id: "p-1", playerName: "Ana", rank: 1, legend: legend("card-a", "Ahri") }),
      metaPlayer({ id: "p-2", playerName: "Bo", rank: 2, legend: legend("card-b", "Braum") }),
      metaPlayer({ id: "p-3", playerName: "Cy", rank: 9, legend: legend("card-a", "Ahri") }),
    ]);

    expect(tiles()).toHaveLength(2);
    expect(within(tiles()[0]!).getByText("Ana")).toBeInTheDocument();
    expect(screen.queryByText("Cy")).toBeNull();
  });

  it("orders the legends by the finish behind them", () => {
    renderFinishes([
      metaPlayer({ id: "p-1", playerName: "Ana", rank: 4, legend: legend("card-a", "Ahri") }),
      metaPlayer({ id: "p-2", playerName: "Bo", rank: 2, legend: legend("card-b", "Braum") }),
    ]);

    expect(tiles().map((tile) => tile.textContent)).toEqual([
      expect.stringContaining("Bo"),
      expect.stringContaining("Ana"),
    ]);
  });

  it("prints the pilot's finish and record", () => {
    renderFinishes([
      metaPlayer({ id: "p-1", playerName: "Ana", rank: 4, wins: 5, losses: 2, draws: 1 }),
    ]);

    const tile = within(tiles()[0]!);
    expect(tile.getByText("4th")).toBeInTheDocument();
    expect(tile.getByText("5-2-1")).toBeInTheDocument();
  });

  it("prints a podium finish in its ordinal form", () => {
    renderFinishes([metaPlayer({ id: "p-1", playerName: "Ana", rank: 2 })]);

    expect(within(tiles()[0]!).getByText("2nd")).toBeInTheDocument();
  });

  it("names the bracket each finish reached inside the top cut, and nothing below it", () => {
    renderFinishes(
      [
        metaPlayer({ id: "p-1", playerName: "Ana", rank: 1, legend: legend("card-a", "Ahri") }),
        metaPlayer({ id: "p-2", playerName: "Bo", rank: 2, legend: legend("card-b", "Braum") }),
        metaPlayer({ id: "p-3", playerName: "Cy", rank: 6, legend: legend("card-c", "Caitlyn") }),
        metaPlayer({ id: "p-4", playerName: "Di", rank: 12, legend: legend("card-d", "Darius") }),
      ],
      [],
      [metaPhase()],
    );

    expect(
      tiles().map(
        (tile) => within(tile).queryByText(/^(?:Winner|Finalist|Top \d+)$/u)?.textContent ?? null,
      ),
    ).toEqual(["Winner", "Finalist", "Top 8", null]);
  });

  it("leads the legend to its archive page and the pilot to theirs", () => {
    renderFinishes([metaPlayer({ id: "p-1", playerName: "Ana", playerKey: "u1001" })]);

    const tile = within(tiles()[0]!);
    expect(tile.getByRole("link", { name: "Yasuo" })).toHaveAttribute(
      "href",
      "/meta/legends/yasuo-yasuo-the-unforgiven",
    );
    expect(tile.getByRole("link", { name: "Ana" })).toHaveAttribute("href", "/meta/players/u1001");
  });

  it("leads a pilot with a charted run to their run through the event", () => {
    renderFinishes(
      [metaPlayer({ id: "p-1", playerName: "Ana", playerKey: "u1001" })],
      [metaMatch({ player1Id: "p-1", player2Id: "p-2" })],
    );

    expect(within(tiles()[0]!).getByRole("link", { name: "Ana" })).toHaveAttribute(
      "href",
      "/meta/summoner-skirmish/players/u1001",
    );
  });

  it("links the pilot's decklist from the tile when one is on file", () => {
    renderFinishes([
      metaPlayer({ id: "p-1", playerName: "Ana", shareToken: "tok1", listStatus: "full" }),
    ]);

    expect(within(tiles()[0]!).getByRole("link", { name: "Deck" })).toHaveAttribute(
      "href",
      "/meta/decks/tok1",
    );
  });

  it("offers no deck link for a pilot without a decklist", () => {
    renderFinishes([metaPlayer({ id: "p-1", playerName: "Ana" })]);

    expect(within(tiles()[0]!).queryByRole("link", { name: "Deck" })).toBeNull();
  });

  it("counts nothing about how many pilots brought a legend", () => {
    renderFinishes([
      metaPlayer({ id: "p-1", playerName: "Ana", rank: 1, legend: legend("card-a", "Ahri") }),
      metaPlayer({ id: "p-2", playerName: "Bo", rank: 2, legend: legend("card-a", "Ahri") }),
      metaPlayer({ id: "p-3", playerName: "Cy", rank: 3, legend: legend("card-a", "Ahri") }),
    ]);

    expect(screen.queryByText(/pilots?|players?|entries|%|\(3\)/u)).toBeNull();
  });

  it("opens a wide field partly, then shows the rest on request", async () => {
    const user = userEvent.setup();
    renderFinishes(field(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]));

    expect(tiles()).toHaveLength(8);
    await user.click(screen.getByRole("button", { name: "Show all 10" }));
    expect(tiles()).toHaveLength(10);

    await user.click(screen.getByRole("button", { name: "Show fewer" }));
    expect(tiles()).toHaveLength(8);
  });

  it("offers no toggle for a field whose legends already fit", () => {
    renderFinishes(field(["a", "b", "c", "d", "e", "f", "g", "h"]));

    expect(tiles()).toHaveLength(8);
    expect(screen.queryByRole("button", { name: /Show all/u })).toBeNull();
  });
});
