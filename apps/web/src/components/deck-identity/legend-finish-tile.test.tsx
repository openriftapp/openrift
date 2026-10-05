import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LegendFinishGrid, LegendFinishTile } from "./legend-finish-tile";

describe("LegendFinishTile", () => {
  it("renders the rank band and every slot", () => {
    render(
      <LegendFinishTile
        rank={3}
        rankText="3rd"
        rankLabel="Top 4"
        imageId={null}
        identity={<span>Jinx</span>}
        player="Summoner"
        detail="5-1"
        action={<a href="/deck">Deck</a>}
      />,
    );
    expect(screen.getByText("3rd")).toBeInTheDocument();
    expect(screen.getByText("Top 4")).toBeInTheDocument();
    expect(screen.getByText("Jinx")).toBeInTheDocument();
    expect(screen.getByText("Summoner")).toHaveClass("truncate");
    expect(screen.getByText("5-1")).toHaveClass("tabular-nums");
    expect(screen.getByRole("link", { name: "Deck" })).toBeInTheDocument();
  });

  it("leaves out the image, detail and action when absent", () => {
    const { container } = render(
      <LegendFinishTile rank={9} rankText="9th" imageId={null} identity={null} player="Summoner" />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".tabular-nums.text-muted-foreground")).toBeNull();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("rings the tile in the rank's tone", () => {
    const { container } = render(
      <LegendFinishTile rank={1} rankText="1st" imageId={null} identity={null} player="Summoner" />,
    );
    expect(container.querySelector("[data-slot=card]")?.className).toMatch(/ring-/u);
  });
});

const legends = Array.from({ length: 10 }, (_, index) => `Legend ${index + 1}`);

describe("LegendFinishGrid", () => {
  it("shows eight tiles and toggles the rest", () => {
    render(
      <LegendFinishGrid
        heading={<h2>Best per Legend</h2>}
        items={legends}
        getKey={(legend) => legend}
        renderTile={(legend) => <span>{legend}</span>}
      />,
    );
    expect(screen.getByRole("heading", { name: "Best per Legend" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
    expect(screen.queryByText("Legend 9")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show all 10" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(10);

    fireEvent.click(screen.getByRole("button", { name: "Show fewer" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
  });

  it("has no toggle when everything fits", () => {
    render(
      <LegendFinishGrid
        heading={<h2>Best per Legend</h2>}
        items={legends.slice(0, 8)}
        getKey={(legend) => legend}
        renderTile={(legend) => <span>{legend}</span>}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
