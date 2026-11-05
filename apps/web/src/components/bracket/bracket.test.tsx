import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  BracketColumn,
  BracketColumns,
  BracketEmptySeat,
  BracketMatchCard,
  BracketRankMark,
  BracketSeatRow,
  BracketSeedMark,
} from "./bracket";

describe("BracketColumns", () => {
  it("lays out one grid column per round with its label", () => {
    const { container } = render(
      <BracketColumns columnCount={2}>
        <BracketColumn label="Semifinals">semis</BracketColumn>
        <BracketColumn label="Final">final</BracketColumn>
      </BracketColumns>,
    );
    const grid = container.querySelector<HTMLElement>("[data-slot=bracket-columns]");
    expect(grid?.style.gridTemplateColumns).toBe("repeat(2, minmax(0, 1fr))");
    expect(screen.getByText("Semifinals")).toBeInTheDocument();
    expect(screen.getByText("final")).toBeInTheDocument();
  });
});

describe("BracketMatchCard", () => {
  it("renders the label row only when given one", () => {
    const { rerender } = render(
      <BracketMatchCard label="SF 1" aside="Table 1">
        seats
      </BracketMatchCard>,
    );
    expect(screen.getByText("SF 1")).toBeInTheDocument();
    expect(screen.getByText("Table 1")).toBeInTheDocument();

    rerender(<BracketMatchCard>seats</BracketMatchCard>);
    expect(screen.queryByText("SF 1")).not.toBeInTheDocument();
  });

  it("glows the final", () => {
    const { container } = render(<BracketMatchCard isFinal>seats</BracketMatchCard>);
    const card = container.querySelector<HTMLElement>("[data-slot=card]");
    expect(card).toHaveClass("ring-border-accent/50");
  });
});

describe("BracketSeatRow", () => {
  it("renders the mark, name, notes and score slots", () => {
    render(
      <BracketSeatRow
        winner={false}
        mark={<BracketSeedMark>#3</BracketSeedMark>}
        name="Ashe"
        score={2}
      >
        <span>chooses starter</span>
      </BracketSeatRow>,
    );
    expect(screen.getByText("#3")).toBeInTheDocument();
    expect(screen.getByText("Ashe")).toHaveClass("truncate");
    expect(screen.getByText("chooses starter")).toBeInTheDocument();
    expect(screen.getByText("2")).toHaveClass("tabular-nums");
  });

  it("bolds the winner and mutes the loser", () => {
    render(
      <>
        <BracketSeatRow winner name="Jinx" score={2} />
        <BracketSeatRow winner={false} name="Sett" score={0} />
      </>,
    );
    const winner = screen.getByText("Jinx").closest("[data-slot=bracket-seat]");
    const loser = screen.getByText("Sett").closest("[data-slot=bracket-seat]");
    expect(winner).toHaveClass("font-semibold");
    expect(winner).toHaveAttribute("data-winner", "true");
    expect(loser).toHaveClass("text-muted-foreground");
    expect(loser).not.toHaveAttribute("data-winner");
  });

  it("keeps an empty mark column when no mark is given", () => {
    render(<BracketSeatRow winner={false} name="Garen" score="–" />);
    const seat = screen.getByText("Garen").closest("[data-slot=bracket-seat]");
    expect(seat?.firstElementChild).toHaveClass("w-16", "h-11");
    expect(seat?.firstElementChild).toBeEmptyDOMElement();
  });

  it("shows a rank mark as a crown band", () => {
    render(
      <BracketSeatRow
        winner
        mark={<BracketRankMark rank={1} text="1st" />}
        name="Ashe"
        score={2}
      />,
    );
    expect(screen.getByText("1st")).toHaveClass("sr-only");
  });

  it("gives place, seed and empty marks one slot size so seats line up", () => {
    render(
      <>
        <BracketSeatRow
          winner
          mark={<BracketRankMark rank={5} text="5th" />}
          name="Ashe"
          score={2}
        />
        <BracketSeatRow
          winner={false}
          mark={<BracketSeedMark>#4</BracketSeedMark>}
          name="Sett"
          score={0}
        />
        <BracketSeatRow winner={false} name="Garen" score="–" />
        <BracketEmptySeat>Winner of SF 1</BracketEmptySeat>
      </>,
    );
    const slots = [...document.querySelectorAll("[data-slot=bracket-seat]")].map(
      (seat) => seat.firstElementChild?.className,
    );
    expect(new Set(slots).size).toBe(1);
    expect(slots[0]).toContain("w-16");
    expect(slots[0]).toContain("h-11");
    expect(document.querySelector("[data-slot=rank-band]")).toHaveClass("w-14");
  });
});

describe("BracketEmptySeat", () => {
  it("renders its placeholder text", () => {
    render(<BracketEmptySeat>Winner of SF 1</BracketEmptySeat>);
    expect(screen.getByText("Winner of SF 1").closest("[data-slot=bracket-seat]")).toHaveClass(
      "text-muted-foreground",
    );
  });
});
