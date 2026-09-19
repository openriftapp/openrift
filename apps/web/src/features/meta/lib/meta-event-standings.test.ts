import { describe, expect, it } from "vitest";

import { metaField } from "@/test/meta-event-fixtures";

import { legendOptions, standingsColumns, subtitleFor } from "./meta-event-standings";

const YASUO = { cardId: "card-yasuo", name: "Yasuo, the Unforgiven", count: 1 };
const AHRI = { cardId: "card-ahri", name: "Ahri, the Nine-Tailed Fox", count: 1 };
const VEX = { cardId: "card-vex", name: "Vex, Gloomist", count: 2 };

describe("legendOptions", () => {
  it("offers nothing when the field played one legend or fewer", () => {
    expect(legendOptions([YASUO])).toEqual({});
    expect(legendOptions([])).toEqual({});
  });

  it("keeps the order the API sent and counts each legend's entries", () => {
    expect(Object.entries(legendOptions([AHRI, VEX, YASUO]))).toEqual([
      ["any", "Any legend"],
      ["card-ahri", "Ahri, the Nine-Tailed Fox (1)"],
      ["card-vex", "Vex, Gloomist (2)"],
      ["card-yasuo", "Yasuo, the Unforgiven (1)"],
    ]);
  });
});

describe("standingsColumns", () => {
  it("shows the legend column when the field named legends", () => {
    expect(standingsColumns(metaField({ hasLegends: true }), false).legend).toBe(true);
  });

  it("hides the legend column for bare placings", () => {
    expect(standingsColumns(metaField(), false).legend).toBe(false);
  });

  it("shows value and deck columns once the archive holds a list", () => {
    const columns = standingsColumns(metaField({ withLists: 1 }), false);

    expect(columns.value).toBe(true);
    expect(columns.deck).toBe(true);
  });

  it("shows the deck column for a viewer who can submit even without lists", () => {
    const columns = standingsColumns(metaField(), true);

    expect(columns.value).toBe(false);
    expect(columns.deck).toBe(true);
  });

  it("files a record column only once the field carries records", () => {
    expect(standingsColumns(metaField({ hasRecords: true }), false).record).toBe(true);
    expect(standingsColumns(metaField(), false).record).toBe(false);
  });

  it("shows the run column only when the event has runs", () => {
    expect(standingsColumns(metaField({ hasRuns: true }), false).run).toBe(true);
    expect(standingsColumns(metaField(), false).run).toBe(false);
  });
});

describe("subtitleFor", () => {
  it("pluralizes a single entry", () => {
    expect(subtitleFor(1, 0)).toBe("1 entry");
  });

  it("pluralizes multiple entries", () => {
    expect(subtitleFor(2, 0)).toBe("2 entries");
  });

  it("appends the decklist count when any entry has one", () => {
    expect(subtitleFor(2, 1)).toBe("2 entries · 1 with a decklist");
  });

  it("groups both counts for the reader's locale", () => {
    expect(subtitleFor(2054, 1247)).toBe("2,054 entries · 1,247 with a decklist");
  });
});
