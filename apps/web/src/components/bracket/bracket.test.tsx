import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  it("lays out one grid column per round, scrolling sideways once they hit their floor", () => {
    const { container } = render(
      <BracketColumns columnCount={2}>
        <BracketColumn label="Semifinals">semis</BracketColumn>
        <BracketColumn label="Final">final</BracketColumn>
      </BracketColumns>,
    );
    const grid = container.querySelector<HTMLElement>("[data-slot=bracket-columns]");
    expect(grid?.style.gridTemplateColumns).toBe("repeat(2, minmax(18rem, 1fr))");
    expect(grid).toHaveClass("lg:overflow-x-auto");
    expect(screen.getByText("Semifinals")).toBeInTheDocument();
    expect(screen.getByText("final")).toBeInTheDocument();
  });
});

describe("BracketColumn", () => {
  it("shows a round without a collapsed state as a plain label", () => {
    render(<BracketColumn label="Final">final</BracketColumn>);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("final")).toBeVisible();
  });

  it("folds a collapsed round behind a toggle below the wide layout", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <BracketColumn label="Semifinals" collapsed>
        semis
      </BracketColumn>,
    );
    const toggle = screen.getByRole("button", { name: /Semifinals/u });
    const matches = container.querySelector("[data-slot=bracket-column-matches]");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveClass("lg:hidden");
    expect(matches).toHaveClass("hidden", "lg:flex");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(matches).not.toHaveClass("hidden");
  });

  it("forgets the reader's choice once the default changes", async () => {
    const user = userEvent.setup();
    const { rerender, container } = render(
      <BracketColumn label="Semifinals" collapsed>
        semis
      </BracketColumn>,
    );
    await user.click(screen.getByRole("button", { name: /Semifinals/u }));
    rerender(<BracketColumn label="Semifinals">semis</BracketColumn>);
    rerender(
      <BracketColumn label="Semifinals" collapsed>
        semis
      </BracketColumn>,
    );
    expect(container.querySelector("[data-slot=bracket-column-matches]")).toHaveClass("hidden");
  });
});

describe("BracketMatchCard", () => {
  it("renders a footer only when given one", () => {
    const { rerender } = render(
      <BracketMatchCard footer={<span>Enter result</span>}>seats</BracketMatchCard>,
    );
    expect(screen.getByText("Enter result").parentElement).toHaveClass("border-t");
    rerender(<BracketMatchCard>seats</BracketMatchCard>);
    expect(screen.queryByText("Enter result")).not.toBeInTheDocument();
  });

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

  it("fades an undecided match behind a dashed edge, keeping the final's ring", () => {
    const { container, rerender } = render(<BracketMatchCard pending>seats</BracketMatchCard>);
    const card = () => container.querySelector<HTMLElement>("[data-slot=card]");
    expect(card()).toHaveClass("opacity-60", "border-dashed", "ring-0");

    rerender(
      <BracketMatchCard pending isFinal>
        seats
      </BracketMatchCard>,
    );
    expect(card()).toHaveClass("opacity-60", "ring-border-accent/50");
    expect(card()).not.toHaveClass("border-dashed");
  });
});

describe("BracketSeatRow", () => {
  it("renders the mark, name, notes and score slots", () => {
    render(
      <BracketSeatRow mark={<BracketSeedMark>#3</BracketSeedMark>} name="Ashe" score={2}>
        <span>chooses starter</span>
      </BracketSeatRow>,
    );
    expect(screen.getByText("#3")).toBeInTheDocument();
    expect(screen.getByText("Ashe")).toHaveClass("truncate");
    expect(screen.getByText("chooses starter")).toBeInTheDocument();
    expect(screen.getByText("2")).toHaveClass("tabular-nums");
  });

  it("tints and bolds the winner and mutes the loser", () => {
    render(
      <>
        <BracketSeatRow outcome="won" name="Jinx" score={2} />
        <BracketSeatRow outcome="lost" name="Sett" score={0} />
      </>,
    );
    const winner = screen.getByText("Jinx").closest("[data-slot=bracket-seat]");
    const loser = screen.getByText("Sett").closest("[data-slot=bracket-seat]");
    expect(winner).toHaveClass("font-semibold", "bg-primary/10");
    expect(winner).toHaveAttribute("data-outcome", "won");
    expect(screen.getByText("2")).toHaveClass("text-primary");
    expect(loser).toHaveClass("text-muted-foreground");
    expect(loser).toHaveAttribute("data-outcome", "lost");
  });

  it("leaves an undecided seat unstyled", () => {
    render(<BracketSeatRow name="Vi" score="–" />);
    const seat = screen.getByText("Vi").closest("[data-slot=bracket-seat]");
    expect(seat).not.toHaveAttribute("data-outcome");
    expect(seat).not.toHaveClass("text-muted-foreground");
    expect(seat).not.toHaveClass("font-semibold");
  });

  it("keeps an empty mark column when no mark is given", () => {
    render(<BracketSeatRow name="Garen" score="–" />);
    const seat = screen.getByText("Garen").closest("[data-slot=bracket-seat]");
    expect(seat?.firstElementChild).toHaveClass("w-16", "h-11");
    expect(seat?.firstElementChild).toBeEmptyDOMElement();
  });

  it("shows a rank mark as a crown band", () => {
    render(
      <BracketSeatRow
        outcome="won"
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
          outcome="won"
          mark={<BracketRankMark rank={5} text="5th" />}
          name="Ashe"
          score={2}
        />
        <BracketSeatRow mark={<BracketSeedMark>#4</BracketSeedMark>} name="Sett" score={0} />
        <BracketSeatRow name="Garen" score="–" />
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
