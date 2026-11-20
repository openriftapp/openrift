import type { MetaStandingsRow } from "@openrift/shared/types/api/meta";
import { describe, expect, it } from "vitest";

import { groupStandingsByLegend, unknownLegendCount } from "@/features/meta/lib/meta-legend-groups";

function row(id: string, cardId: string | null): MetaStandingsRow {
  return { id, legend: cardId === null ? null : { cardId } } as unknown as MetaStandingsRow;
}

const legends = [
  { cardId: "kaisa", name: "Kai'Sa, Daughter of the Void", count: 52 },
  { cardId: "kennen", name: "Kennen, Heart of the Tempest", count: 45 },
  { cardId: "poppy", name: "Poppy, Keeper of the Hammer", count: 1 },
  { cardId: "riven", name: "Riven, The Exile", count: 126 },
];

describe("groupStandingsByLegend", () => {
  it("orders groups by their best finish and keeps rank order inside each", () => {
    const groups = groupStandingsByLegend([
      row("p1", "kennen"),
      row("p2", "riven"),
      row("p3", "kennen"),
      row("p4", "kaisa"),
      row("p5", "riven"),
    ]);
    expect(groups.map((group) => group.cardId)).toEqual(["kennen", "riven", "kaisa"]);
    expect(groups[0]?.players.map((player) => player.id)).toEqual(["p1", "p3"]);
  });

  it("puts the entries without a legend last", () => {
    const groups = groupStandingsByLegend([row("p1", null), row("p2", "riven")]);
    expect(groups.map((group) => group.cardId)).toEqual(["riven", "none"]);
  });

  it("returns nothing for no entries", () => {
    expect(groupStandingsByLegend([])).toEqual([]);
  });
});

describe("unknownLegendCount", () => {
  it("counts the entries no legend accounts for", () => {
    expect(unknownLegendCount(legends, 230)).toBe(6);
  });

  it("is zero when every entry names a legend", () => {
    expect(unknownLegendCount(legends, 224)).toBe(0);
    expect(unknownLegendCount(legends, 10)).toBe(0);
  });
});
