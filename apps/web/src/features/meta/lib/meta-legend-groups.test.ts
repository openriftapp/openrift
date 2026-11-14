import type { MetaStandingsRow } from "@openrift/shared/types/api/meta";
import { describe, expect, it } from "vitest";

import {
  legendGroups,
  openLegendIds,
  unknownLegendGroup,
} from "@/features/meta/lib/meta-legend-groups";

function bestRow(cardId: string, rank: number): MetaStandingsRow {
  return { rank, legend: { cardId } } as unknown as MetaStandingsRow;
}

const legends = [
  { cardId: "kaisa", name: "Kai'Sa, Daughter of the Void", count: 52 },
  { cardId: "kennen", name: "Kennen, Heart of the Tempest", count: 45 },
  { cardId: "poppy", name: "Poppy, Keeper of the Hammer", count: 1 },
  { cardId: "riven", name: "Riven, The Exile", count: 126 },
];

describe("legendGroups", () => {
  it("orders legends by their best finish", () => {
    const groups = legendGroups(legends, [
      bestRow("kennen", 1),
      bestRow("riven", 2),
      bestRow("kaisa", 5),
      bestRow("poppy", 290),
    ]);
    expect(groups.map((group) => group.cardId)).toEqual(["kennen", "riven", "kaisa", "poppy"]);
    expect(groups[1]).toMatchObject({ name: "Riven, The Exile", count: 126 });
    expect(groups[1]?.best?.rank).toBe(2);
  });

  it("puts legends without a best row last, by name", () => {
    const groups = legendGroups(legends, [bestRow("riven", 2), bestRow("poppy", 290)]);
    expect(groups.map((group) => group.cardId)).toEqual(["riven", "poppy", "kaisa", "kennen"]);
    expect(groups[2]?.best).toBeNull();
  });

  it("breaks a tied best rank by name", () => {
    const groups = legendGroups(legends.slice(0, 2), [bestRow("kennen", 9), bestRow("kaisa", 9)]);
    expect(groups.map((group) => group.cardId)).toEqual(["kaisa", "kennen"]);
  });

  it("ignores best rows whose legend is missing", () => {
    const orphan = { rank: 1, legend: null } as unknown as MetaStandingsRow;
    const groups = legendGroups(legends.slice(0, 1), [orphan]);
    expect(groups).toEqual([{ ...legends[0], best: null }]);
  });

  it("returns nothing for an event without legends", () => {
    expect(legendGroups([], [])).toEqual([]);
  });
});

describe("unknownLegendGroup", () => {
  it("groups the entries no legend accounts for", () => {
    expect(unknownLegendGroup(legends, 230)).toEqual({
      cardId: "none",
      name: "",
      count: 6,
      best: null,
    });
  });

  it("is null when every entry names a legend", () => {
    expect(unknownLegendGroup(legends, 224)).toBeNull();
    expect(unknownLegendGroup(legends, 10)).toBeNull();
  });
});

describe("openLegendIds", () => {
  const groups = legendGroups(legends, [bestRow("kennen", 1), bestRow("riven", 2)]);

  it("opens the first group until the reader touches one", () => {
    expect(openLegendIds(null, groups)).toEqual(["kennen"]);
  });

  it("keeps what the reader opened, including nothing", () => {
    expect(openLegendIds(["riven"], groups)).toEqual(["riven"]);
    expect(openLegendIds([], groups)).toEqual([]);
  });

  it("opens nothing when there are no groups", () => {
    expect(openLegendIds(null, [])).toEqual([]);
  });
});
