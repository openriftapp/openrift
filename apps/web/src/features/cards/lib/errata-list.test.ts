import type {
  ErrataAnnouncement,
  ErrataEntry,
  ErrataListResponse,
} from "@openrift/shared/contracts/errata";
import { describe, expect, it } from "vitest";

import {
  UNANNOUNCED_GROUP_ID,
  countErrataBySet,
  errataGroupId,
  errataGroupIdForCard,
  groupErrata,
  latestErrataUpdate,
} from "./errata-list";

const VENDETTA: ErrataAnnouncement = {
  id: "a-ven",
  name: "Vendetta Errata Updates",
  publishedOn: "2026-07-23",
  url: "https://example.invalid/ven",
};
const ORIGINS: ErrataAnnouncement = {
  id: "a-ogn",
  name: "Origins Card Errata",
  publishedOn: "2025-10-21",
  url: "https://example.invalid/ogn",
};

function entry(overrides: Partial<ErrataEntry> & { name: string }): ErrataEntry {
  const { name, ...rest } = overrides;
  return {
    announcementId: VENDETTA.id,
    source: null,
    sourceUrl: null,
    effectiveDate: null,
    correctedRulesText: "Draw a card.",
    correctedEffectText: null,
    card: { slug: name.toLowerCase(), name, types: ["unit"], tags: [], domains: ["calm"] },
    printing: {
      shortCode: "VEN-001",
      setSlug: "VEN",
      printedRulesText: "Draw two cards.",
      printedEffectText: null,
      imageId: null,
    },
    ...rest,
  };
}

const NO_FILTERS = { query: "", setSlug: null };

function data(entries: ErrataEntry[]): ErrataListResponse {
  return { announcements: [ORIGINS, VENDETTA], sets: [], entries };
}

describe("groupErrata", () => {
  it("orders announcements newest first and the unannounced changes last", () => {
    const groups = groupErrata(
      data([
        entry({ name: "Gold", announcementId: null, source: "UNL-T05" }),
        entry({ name: "Arise", announcementId: ORIGINS.id }),
        entry({ name: "Astral Heron" }),
      ]),
      NO_FILTERS,
    );
    expect(groups.map((group) => group.id)).toEqual([
      "vendetta-errata-updates",
      "origins-card-errata",
      UNANNOUNCED_GROUP_ID,
    ]);
    expect(groups.at(-1)?.announcement).toBeNull();
  });

  it("drops announcements without any errata", () => {
    const groups = groupErrata(data([entry({ name: "Astral Heron" })]), NO_FILTERS);
    expect(groups.map((group) => group.id)).toEqual(["vendetta-errata-updates"]);
  });

  it("sorts entries by display name, composing legend names", () => {
    const groups = groupErrata(
      data([
        entry({ name: "Zephyr" }),
        entry({
          name: "Emperor of the Sands",
          card: {
            slug: "azir",
            name: "Emperor of the Sands",
            types: ["legend"],
            tags: ["Azir"],
            domains: [],
          },
        }),
      ]),
      NO_FILTERS,
    );
    expect(groups[0]?.entries.map((item) => item.card.slug)).toEqual(["azir", "zephyr"]);
  });

  it("sorts unannounced changes by date seen, newest first, undated last", () => {
    const groups = groupErrata(
      data([
        entry({ name: "Undated", announcementId: null, source: "x" }),
        entry({ name: "Older", announcementId: null, source: "x", effectiveDate: "2026-01-01" }),
        entry({ name: "Newer", announcementId: null, source: "x", effectiveDate: "2026-05-01" }),
      ]),
      NO_FILTERS,
    );
    expect(groups[0]?.entries.map((item) => item.card.name)).toEqual(["Newer", "Older", "Undated"]);
  });

  it("filters by set but keeps the group total", () => {
    const groups = groupErrata(
      data([
        entry({ name: "Astral Heron" }),
        entry({
          name: "Arise",
          printing: {
            shortCode: "OGN-001",
            setSlug: "OGN",
            printedRulesText: null,
            printedEffectText: null,
            imageId: null,
          },
        }),
      ]),
      { query: "", setSlug: "OGN" },
    );
    expect(groups[0]?.total).toBe(2);
    expect(groups[0]?.entries.map((item) => item.card.name)).toEqual(["Arise"]);
  });

  it("matches the query against the name and the updated text", () => {
    const entries = [
      entry({ name: "Astral Heron", correctedRulesText: "Play this turn." }),
      entry({ name: "Doran’s Shield", correctedRulesText: "Gain armor." }),
    ];
    expect(
      groupErrata(data(entries), { query: "doran's", setSlug: null })[0]?.entries.map(
        (item) => item.card.name,
      ),
    ).toEqual(["Doran’s Shield"]);
    expect(
      groupErrata(data(entries), { query: "this turn", setSlug: null })[0]?.entries.map(
        (item) => item.card.name,
      ),
    ).toEqual(["Astral Heron"]);
  });
});

describe("errataGroupId", () => {
  it("slugs the announcement name", () => {
    expect(errataGroupId(VENDETTA)).toBe("vendetta-errata-updates");
  });
});

describe("errataGroupIdForCard", () => {
  const response = data([
    entry({ name: "Arise", announcementId: ORIGINS.id }),
    entry({ name: "Gold", announcementId: null, source: "x" }),
  ]);

  it("names the announcement group a card sits in", () => {
    expect(errataGroupIdForCard(response, "arise")).toBe("origins-card-errata");
  });

  it("names the unannounced group for an unannounced card", () => {
    expect(errataGroupIdForCard(response, "gold")).toBe(UNANNOUNCED_GROUP_ID);
  });

  it("returns null for a card without errata", () => {
    expect(errataGroupIdForCard(response, "missing")).toBeNull();
  });
});

describe("countErrataBySet", () => {
  it("counts entries per set and skips entries without a printing", () => {
    const counts = countErrataBySet([
      entry({ name: "A" }),
      entry({ name: "B" }),
      entry({ name: "C", printing: null }),
    ]);
    expect([...counts]).toEqual([["VEN", 2]]);
  });
});

describe("latestErrataUpdate", () => {
  it("returns the newest publication day", () => {
    expect(latestErrataUpdate([ORIGINS, VENDETTA])).toBe("2026-07-23");
  });

  it("returns null without announcements", () => {
    expect(latestErrataUpdate([])).toBeNull();
  });
});
