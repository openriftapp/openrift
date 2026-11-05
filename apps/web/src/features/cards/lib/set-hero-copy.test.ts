import type { SetListEntry } from "@openrift/shared/types/api/catalog";
import { describe, expect, it } from "vitest";

import {
  cardLanguageForLocale,
  cardLanguageName,
  groupReleases,
  isSetUpcoming,
  otherReleases,
  primaryRelease,
  releaseDateText,
  releaseStatusText,
  setReleaseSentence,
  setsOverviewSentence,
} from "./set-hero-copy";

const TODAY = "2026-10-02";

function set(overrides: Partial<SetListEntry>): SetListEntry {
  return {
    id: overrides.slug ?? "set",
    slug: "SET",
    name: "Set",
    releases: {},
    setType: "main",
    printedTotal: null,
    cardCount: 0,
    printingCount: 0,
    coverImageId: null,
    ...overrides,
  };
}

describe("cardLanguageName", () => {
  it("names the card languages whose codes are not language tags", () => {
    expect(cardLanguageName("EN")).toBe("English");
    expect(cardLanguageName("KR")).toBe("Korean");
    expect(cardLanguageName("SC")).toBe("Simplified Chinese");
    expect(cardLanguageName("TC")).toBe("Traditional Chinese");
  });
});

describe("groupReleases", () => {
  it("orders dated releases and merges languages that share a date", () => {
    const groups = groupReleases({
      FR: { releasedAt: "2026-05-29", precision: "day" },
      SC: { releasedAt: "2025-10-31", precision: "day" },
      EN: { releasedAt: "2025-10-31", precision: "day" },
      KR: { releasedAt: null, precision: null },
    });

    expect(groups.map((group) => group.languages)).toEqual([["EN", "SC"], ["FR"]]);
  });

  it("keeps a month release apart from a day release on the same first day", () => {
    const groups = groupReleases({
      EN: { releasedAt: "2026-11-01", precision: "day" },
      FR: { releasedAt: "2026-11-01", precision: "month" },
    });

    expect(groups).toHaveLength(2);
  });
});

describe("setReleaseSentence", () => {
  it("lists past releases oldest first", () => {
    expect(
      setReleaseSentence(
        {
          EN: { releasedAt: "2025-10-31", precision: "day" },
          SC: { releasedAt: "2025-08-01", precision: "day" },
        },
        TODAY,
      ),
    ).toBe("Released in Simplified Chinese on Aug 1, 2025 and in English on Oct 31, 2025.");
  });

  it("puts upcoming releases in their own sentence", () => {
    expect(
      setReleaseSentence(
        {
          EN: { releasedAt: "2026-07-31", precision: "day" },
          FR: { releasedAt: "2026-10-23", precision: "day" },
        },
        TODAY,
      ),
    ).toBe("Released in English on Jul 31, 2026. Releases in French on Oct 23, 2026.");
  });

  it("words month, quarter and year releases as periods", () => {
    expect(
      setReleaseSentence(
        {
          EN: { releasedAt: "2027-01-01", precision: "month" },
          FR: { releasedAt: "2027-04-01", precision: "quarter" },
          KR: { releasedAt: "2028-01-01", precision: "year" },
        },
        TODAY,
      ),
    ).toBe("Releases in English in January 2027, in French in Q2 2027, and in Korean in 2028.");
  });

  it("returns null when no release is dated", () => {
    expect(setReleaseSentence({ EN: { releasedAt: null, precision: null } }, TODAY)).toBeNull();
    expect(setReleaseSentence({}, TODAY)).toBeNull();
  });
});

describe("setsOverviewSentence", () => {
  const vendetta = set({
    slug: "VEN",
    name: "Vendetta",
    releases: { EN: { releasedAt: "2026-07-31", precision: "day" } },
  });
  const origins = set({
    slug: "OGN",
    name: "Origins",
    releases: { EN: { releasedAt: "2025-10-31", precision: "day" } },
  });
  const radiance = set({
    slug: "RAD",
    name: "Radiance",
    releases: { EN: { releasedAt: "2026-10-23", precision: "day" } },
    printedTotal: 167,
    cardCount: 66,
  });
  const legacy = set({
    slug: "LGC",
    name: "Legacy",
    releases: { EN: { releasedAt: "2027-01-29", precision: "day" } },
  });

  it("names the newest set and the next one with its reveal progress", () => {
    expect(setsOverviewSentence([origins, vendetta, radiance, legacy], TODAY)).toBe(
      "Vendetta is the newest set. Radiance releases on Oct 23, 2026, and 66 of its 167 cards are listed so far.",
    );
  });

  it("drops the progress once every card is listed", () => {
    expect(setsOverviewSentence([vendetta, { ...radiance, cardCount: 167 }], TODAY)).toBe(
      "Vendetta is the newest set. Radiance releases on Oct 23, 2026.",
    );
  });

  it("ignores supplemental sets", () => {
    const box = set({
      name: "Arcane Box Set",
      setType: "supplemental",
      releases: { EN: { releasedAt: "2026-09-01", precision: "day" } },
    });

    expect(setsOverviewSentence([vendetta, box], TODAY)).toBe("Vendetta is the newest set.");
  });

  it("returns null without any dated main set", () => {
    expect(setsOverviewSentence([set({})], TODAY)).toBeNull();
  });

  it("counts a set as newest only once it is out in the viewer's language", () => {
    const chineseFirst = set({
      name: "Radiance",
      releases: {
        SC: { releasedAt: "2026-09-01", precision: "day" },
        EN: { releasedAt: "2026-10-23", precision: "day" },
      },
    });

    expect(setsOverviewSentence([vendetta, chineseFirst], TODAY, "EN")).toBe(
      "Vendetta is the newest set. Radiance releases on Oct 23, 2026.",
    );
    expect(setsOverviewSentence([vendetta, chineseFirst], TODAY, "SC")).toBe(
      "Radiance is the newest set.",
    );
  });
});

describe("cardLanguageForLocale", () => {
  it("maps locales with their own card language and falls back to English", () => {
    expect(cardLanguageForLocale("fr")).toBe("FR");
    expect(cardLanguageForLocale("zh-Hant")).toBe("TC");
    expect(cardLanguageForLocale("de")).toBe("EN");
  });
});

describe("primaryRelease", () => {
  it("prefers the English release over an earlier one", () => {
    const releases = {
      SC: { releasedAt: "2025-08-01", precision: "day" as const },
      EN: { releasedAt: "2025-10-31", precision: "day" as const },
    };
    expect(primaryRelease(releases)?.language).toBe("EN");
    expect(otherReleases(releases).map((entry) => entry.language)).toEqual(["SC"]);
  });

  it("falls back to the earliest dated release", () => {
    const releases = {
      EN: { releasedAt: null, precision: null },
      FR: { releasedAt: "2026-05-29", precision: "day" as const },
      KR: { releasedAt: "2026-01-01", precision: "day" as const },
    };
    expect(primaryRelease(releases)?.language).toBe("KR");
    expect(otherReleases(releases).map((entry) => entry.language)).toEqual(["FR"]);
  });

  it("is undefined without a dated release", () => {
    expect(primaryRelease({})).toBeUndefined();
    expect(otherReleases({})).toEqual([]);
  });
});

describe("releaseDateText", () => {
  it("shows the date at the precision it is known to", () => {
    expect(releaseDateText({ releasedAt: "2025-10-31", precision: "day" })).toBe("Oct 31, 2025");
    expect(releaseDateText({ releasedAt: "2026-11-01", precision: "month" })).toBe("November 2026");
    expect(releaseDateText({ releasedAt: "2026-04-01", precision: "quarter" })).toBe("Q2 2026");
    expect(releaseDateText({ releasedAt: "2026-01-01", precision: "year" })).toBe("2026");
  });

  it("is empty for an undated release", () => {
    expect(releaseDateText({ releasedAt: null, precision: null })).toBe("");
  });
});

describe("releaseStatusText", () => {
  it("words a day release with the bare date", () => {
    expect(releaseStatusText({ releasedAt: "2025-10-31", precision: "day" }, TODAY)).toBe(
      "Released Oct 31, 2025",
    );
    expect(releaseStatusText({ releasedAt: "2026-10-23", precision: "day" }, TODAY)).toBe(
      "Releases Oct 23, 2026",
    );
  });

  it("words month, quarter and year releases as periods", () => {
    expect(releaseStatusText({ releasedAt: "2026-11-01", precision: "month" }, TODAY)).toBe(
      "Releases in November 2026",
    );
    expect(releaseStatusText({ releasedAt: "2026-07-01", precision: "quarter" }, TODAY)).toBe(
      "Released in Q3 2026",
    );
    expect(releaseStatusText({ releasedAt: "2027-01-01", precision: "year" }, TODAY)).toBe(
      "Releases in 2027",
    );
  });

  it("counts a period as released only once it has ended", () => {
    expect(releaseStatusText({ releasedAt: "2026-10-01", precision: "quarter" }, TODAY)).toBe(
      "Releases in Q4 2026",
    );
  });
});

describe("primaryRelease with card languages", () => {
  it("picks the first of your languages that has a date", () => {
    const releases = {
      EN: { releasedAt: "2027-01-01", precision: "day" as const },
      SC: { releasedAt: "2026-01-01", precision: "day" as const },
    };
    expect(primaryRelease(releases, ["FR", "SC", "EN"])?.language).toBe("SC");
    expect(otherReleases(releases, ["SC"]).map((entry) => entry.language)).toEqual(["EN"]);
  });
});

describe("otherReleases", () => {
  it("is empty when every other language shares the shown date", () => {
    expect(
      otherReleases({
        EN: { releasedAt: "2025-10-31", precision: "day" },
        FR: { releasedAt: "2025-10-31", precision: "day" },
        KR: { releasedAt: "2025-10-31", precision: "day" },
      }),
    ).toEqual([]);
  });

  it("lists every other language once one date differs", () => {
    expect(
      otherReleases({
        EN: { releasedAt: "2025-10-31", precision: "day" },
        FR: { releasedAt: "2025-10-31", precision: "day" },
        KR: { releasedAt: "2026-01-01", precision: "day" },
      }).map((entry) => entry.language),
    ).toEqual(["FR", "KR"]);
  });

  it("treats the same first day at a different precision as a different date", () => {
    expect(
      otherReleases({
        EN: { releasedAt: "2026-11-01", precision: "day" },
        FR: { releasedAt: "2026-11-01", precision: "month" },
      }).map((entry) => entry.language),
    ).toEqual(["FR"]);
  });

  it("ignores undated languages", () => {
    expect(
      otherReleases({
        EN: { releasedAt: "2025-10-31", precision: "day" },
        FR: { releasedAt: null, precision: null },
      }),
    ).toEqual([]);
  });
});

describe("isSetUpcoming", () => {
  it("is true for a set with no cards and no dates", () => {
    expect(isSetUpcoming({ cardCount: 0, releases: {} }, undefined, TODAY)).toBe(true);
  });

  it("is true while every dated release is in the future", () => {
    const releases = { EN: { releasedAt: "2027-01-01", precision: "day" as const } };
    expect(isSetUpcoming({ cardCount: 12, releases }, undefined, TODAY)).toBe(true);
  });

  it("stays upcoming while your languages wait, even if another language is out", () => {
    const releases = {
      EN: { releasedAt: "2027-01-01", precision: "day" as const },
      SC: { releasedAt: "2026-01-01", precision: "day" as const },
    };
    expect(isSetUpcoming({ cardCount: 12, releases }, ["EN"], TODAY)).toBe(true);
    expect(isSetUpcoming({ cardCount: 12, releases }, ["SC"], TODAY)).toBe(false);
  });

  it("falls back to any language when yours have no date", () => {
    const releases = { SC: { releasedAt: "2026-01-01", precision: "day" as const } };
    expect(isSetUpcoming({ cardCount: 12, releases }, ["EN"], TODAY)).toBe(false);
  });

  it("is false for a released set with no cards listed", () => {
    const releases = { EN: { releasedAt: "2025-10-31", precision: "day" as const } };
    expect(isSetUpcoming({ cardCount: 0, releases }, undefined, TODAY)).toBe(false);
  });

  it("is true while the release quarter is still running", () => {
    const releases = { EN: { releasedAt: "2026-10-01", precision: "quarter" as const } };
    expect(isSetUpcoming({ cardCount: 40, releases }, undefined, TODAY)).toBe(true);
  });

  it("is false for a set with cards and no dates", () => {
    expect(isSetUpcoming({ cardCount: 12, releases: {} }, undefined, TODAY)).toBe(false);
  });
});
