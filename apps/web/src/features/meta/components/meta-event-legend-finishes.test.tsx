import type {
  MetaEventPhase,
  MetaEventPlayer,
  MetaStandingsRow,
} from "@openrift/shared/types/api/meta";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { metaPhase, metaPlayer, metaRow } from "@/test/meta-event-fixtures";

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

/** The API folds the field to one entry per legend; the tiles print what it sends. */
function renderFinishes(entries: MetaStandingsRow[], phases: MetaEventPhase[] = []) {
  render(<MetaEventLegendFinishes entries={entries} phases={phases} slug="summoner-skirmish" />);
}

function field(
  names: string[],
  overrides: (index: number) => Partial<MetaStandingsRow> = () => ({}),
) {
  return names.map((name, index) =>
    metaRow({
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
  it("renders nothing for an empty field", () => {
    const { container } = render(
      <MetaEventLegendFinishes entries={[]} phases={[]} slug="summoner-skirmish" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for a field whose entries name no legend", () => {
    const { container } = render(
      <MetaEventLegendFinishes
        entries={[
          metaRow({ id: "p-1", playerName: "Ana", rank: 1, legend: null }),
          metaRow({ id: "p-2", playerName: "Bo", rank: 2, legend: null }),
        ]}
        phases={[]}
        slug="summoner-skirmish"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("gives an entry naming no legend no cell of its own", () => {
    renderFinishes([
      metaRow({ id: "p-1", playerName: "Ana", rank: 1, legend: null }),
      metaRow({ id: "p-2", playerName: "Bo", rank: 2, legend: legend("card-b", "Braum") }),
    ]);

    expect(tiles()).toHaveLength(1);
    expect(screen.queryByText("Ana")).toBeNull();
  });

  it("leaves entries naming no legend out of the count behind the toggle", async () => {
    const user = userEvent.setup();
    renderFinishes([
      ...field(["a", "b", "c", "d", "e", "f", "g", "h", "i"]),
      metaRow({ id: "p-x", playerName: "Nameless", rank: 40, legend: null }),
      metaRow({ id: "p-y", playerName: "Unknown", rank: 41, legend: null }),
    ]);

    await user.click(screen.getByRole("button", { name: "Show all 9" }));
    expect(tiles()).toHaveLength(9);
  });

  it("names one tile per entry, in the order the API sent them", () => {
    renderFinishes([
      metaRow({ id: "p-2", playerName: "Bo", rank: 2, legend: legend("card-b", "Braum") }),
      metaRow({ id: "p-1", playerName: "Ana", rank: 4, legend: legend("card-a", "Ahri") }),
    ]);

    expect(tiles().map((tile) => tile.textContent)).toEqual([
      expect.stringContaining("Bo"),
      expect.stringContaining("Ana"),
    ]);
  });

  it("prints the pilot's finish and record", () => {
    renderFinishes([
      metaRow({ id: "p-1", playerName: "Ana", rank: 4, wins: 5, losses: 2, draws: 1 }),
    ]);

    const tile = within(tiles()[0]!);
    expect(tile.getByText("4th")).toBeInTheDocument();
    expect(tile.getByText("5-2-1")).toBeInTheDocument();
  });

  it("prints a podium finish in its ordinal form", () => {
    renderFinishes([metaRow({ id: "p-1", playerName: "Ana", rank: 2 })]);

    expect(within(tiles()[0]!).getByText("2nd")).toBeInTheDocument();
  });

  it("names the bracket each finish reached inside the top cut, and nothing below it", () => {
    renderFinishes(
      [
        metaRow({ id: "p-1", playerName: "Ana", rank: 1, legend: legend("card-a", "Ahri") }),
        metaRow({ id: "p-2", playerName: "Bo", rank: 2, legend: legend("card-b", "Braum") }),
        metaRow({ id: "p-3", playerName: "Cy", rank: 6, legend: legend("card-c", "Caitlyn") }),
        metaRow({ id: "p-4", playerName: "Di", rank: 12, legend: legend("card-d", "Darius") }),
      ],
      [metaPhase()],
    );

    expect(
      tiles().map(
        (tile) => within(tile).queryByText(/^(?:Winner|Finalist|Top \d+)$/u)?.textContent ?? null,
      ),
    ).toEqual(["Winner", "Finalist", "Top 8", null]);
  });

  it("leads the legend to its archive page and the pilot to theirs", () => {
    renderFinishes([metaRow({ id: "p-1", playerName: "Ana", playerKey: "u1001" })]);

    const tile = within(tiles()[0]!);
    expect(tile.getByRole("link", { name: "Yasuo" })).toHaveAttribute(
      "href",
      "/meta/legends/yasuo-yasuo-the-unforgiven",
    );
    expect(tile.getByRole("link", { name: "Ana" })).toHaveAttribute("href", "/meta/players/u1001");
  });

  it("leads a pilot with a charted run to their run through the event", () => {
    renderFinishes([
      metaRow({
        id: "p-1",
        playerName: "Ana",
        playerKey: "u1001",
        rounds: [{ phaseOrder: 0, roundNumber: 1, isCut: false, outcome: "win" }],
      }),
    ]);

    expect(within(tiles()[0]!).getByRole("link", { name: "Ana" })).toHaveAttribute(
      "href",
      "/meta/summoner-skirmish/players/u1001",
    );
  });

  it("links the pilot's decklist from the tile when one is on file", () => {
    renderFinishes([
      metaRow({ id: "p-1", playerName: "Ana", shareToken: "tok1", listStatus: "full" }),
    ]);

    expect(within(tiles()[0]!).getByRole("link", { name: "Deck" })).toHaveAttribute(
      "href",
      "/meta/decks/tok1",
    );
  });

  it("offers no deck link for a pilot without a decklist", () => {
    renderFinishes([metaRow({ id: "p-1", playerName: "Ana" })]);

    expect(within(tiles()[0]!).queryByRole("link", { name: "Deck" })).toBeNull();
  });

  it("counts nothing about how many pilots brought a legend", () => {
    renderFinishes([
      metaRow({ id: "p-1", playerName: "Ana", rank: 1, legend: legend("card-a", "Ahri") }),
      metaRow({ id: "p-2", playerName: "Bo", rank: 2, legend: legend("card-b", "Braum") }),
      metaRow({ id: "p-3", playerName: "Cy", rank: 3, legend: legend("card-c", "Caitlyn") }),
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
