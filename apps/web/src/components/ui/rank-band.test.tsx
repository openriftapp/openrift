import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RankBand, rankBandRingClass, rankBandTone } from "@/components/ui/rank-band";

function band(): HTMLElement {
  return document.querySelector("[data-slot=rank-band]") as HTMLElement;
}

describe("RankBand", () => {
  it("crowns the winner beside the printed finish and its label", () => {
    render(<RankBand rank={1} text="1st" label="Winner" />);

    expect(band()).toHaveAttribute("data-tone", "gold");
    expect(band().querySelector("svg")).not.toBeNull();
    expect(screen.getByText("1st")).toBeInTheDocument();
    expect(screen.getByText("Winner")).toBeInTheDocument();
  });

  it("shows the winner as the crown alone when asked, keeping the place for screen readers", () => {
    render(<RankBand rank={1} text="1" filled={false} crownOnly />);

    expect(band().querySelector("svg")).not.toBeNull();
    expect(screen.getByText("1")).toHaveClass("sr-only");
  });

  it("prints a finish past the podium without a crown or a label", () => {
    render(<RankBand rank={12} text="12th" label={null} filled={false} />);

    expect(band()).toHaveAttribute("data-tone", "plain");
    expect(band().querySelector("svg")).toBeNull();
    expect(band()).toHaveTextContent(/^12th$/u);
  });

  it("keeps the medal tones on the podium whether or not the band is filled", () => {
    expect([1, 2, 3].map((rank) => rankBandTone(rank, false))).toEqual([
      "gold",
      "silver",
      "bronze",
    ]);
  });

  it("steps a long place down a size and keeps a short one full size", () => {
    render(
      <>
        <RankBand rank={172} text="172nd" filled={false} />
        <RankBand rank={4} text="4th" filled={false} />
      </>,
    );

    expect(screen.getByText("172nd")).toHaveClass("text-lg");
    expect(screen.getByText("172nd")).not.toHaveClass("text-2xl");
    expect(screen.getByText("4th")).toHaveClass("text-2xl");
  });

  it("prints a four-digit place whole in a chip that grows past its minimum width", () => {
    render(<RankBand rank={1234} text="1234th" filled={false} className="min-w-16" />);

    expect(band()).toHaveTextContent(/^1234th$/u);
    expect(screen.getByText("1234th")).toHaveClass(
      "text-base",
      "tabular-nums",
      "whitespace-nowrap",
    );
    expect(band()).toHaveClass("min-w-16", "px-1.5");
    expect(band().className).not.toMatch(/(?<start>^|\s)(?<cls>w-|max-w-|@container)/u);
  });

  it("tints the podium chips and outlines every other place", () => {
    render(
      <>
        <RankBand rank={1} text="1st" filled={false} />
        <RankBand rank={4} text="4th" filled={false} />
      </>,
    );
    const [first, fourth] = [...document.querySelectorAll("[data-slot=rank-band]")];

    expect(first).toHaveClass("bg-amber-500/16", "border-amber-500/60");
    expect(first?.querySelector("svg")).not.toBeNull();
    expect(screen.getByText("1st")).toBeInTheDocument();
    expect(fourth).toHaveClass("border-border", "text-muted-foreground");
    expect(fourth).not.toHaveClass("bg-muted");
  });

  it("keeps the solid medal fill on a tile band", () => {
    render(<RankBand rank={1} text="1st" label="Winner" layout="band" />);

    expect(band()).toHaveClass("bg-amber-500");
    expect(screen.getByText("1st")).toHaveClass("text-2xl");
  });

  it("fills a finish past the podium only when asked", () => {
    expect(rankBandTone(5, true)).toBe("muted");
    expect(rankBandTone(5, false)).toBe("plain");
  });

  it("rings a tile in its medal color and every other tile in the border color", () => {
    expect(rankBandRingClass("bronze")).toBe("ring-amber-700");
    expect(rankBandRingClass("muted")).toBe("ring-border");
  });
});
