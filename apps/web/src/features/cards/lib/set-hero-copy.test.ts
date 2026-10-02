import type { SetListEntry } from "@openrift/shared/types/api/catalog";
import { describe, expect, it } from "vitest";

import {
  cardLanguageForLocale,
  cardLanguageName,
  groupReleases,
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
    ).toBe("Released in Simplified Chinese on 1 August 2025 and in English on 31 October 2025.");
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
    ).toBe("Released in English on 31 July 2026. Releases in French on 23 October 2026.");
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
      "Vendetta is the newest set. Radiance releases on 23 October 2026, and 66 of its 167 cards are listed so far.",
    );
  });

  it("drops the progress once every card is listed", () => {
    expect(setsOverviewSentence([vendetta, { ...radiance, cardCount: 167 }], TODAY)).toBe(
      "Vendetta is the newest set. Radiance releases on 23 October 2026.",
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
      "Vendetta is the newest set. Radiance releases on 23 October 2026.",
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
