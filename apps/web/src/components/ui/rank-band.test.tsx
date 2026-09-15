import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RankBand, rankBandRingClass, rankBandTone } from "@/components/ui/rank-band";

function band(): HTMLElement {
  return document.querySelector("[data-slot=rank-band]") as HTMLElement;
}

describe("RankBand", () => {
  it("crowns the winner beside the printed finish and its label", () => {
    render(<RankBand rank={1} text="1" label="Winner" />);

    expect(band()).toHaveAttribute("data-tone", "gold");
    expect(band().querySelector("svg")).not.toBeNull();
    expect(screen.getByText("1")).toBeInTheDocument();
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

  it("lets a long place step down a size in a narrow slot and keeps a short one full size", () => {
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

  it("prints a four-digit place at body size however wide the column is", () => {
    render(<RankBand rank={2050} text="2050th" filled={false} className="w-24" />);

    expect(screen.getByText("2050th")).toHaveClass("text-base");
    expect(screen.getByText("2050th")).not.toHaveClass("text-2xl");
  });

  it("gives a crowned winner's place the room to stay full size in a wide column", () => {
    render(<RankBand rank={1} text="1st" filled={false} />);

    expect(screen.getByText("1st")).toHaveClass("text-2xl");
    expect(screen.getByText("1st")).toHaveClass("@max-[3.75rem]:text-lg");
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
