import type { SearchResponse } from "@openrift/shared/contracts/search";
import { describe, expect, it } from "vitest";

import { buildSearchEmbed, searchErrorText, searchPageUrl } from "./search-embed";

const SITE = "https://openrift.test";

function response(total: number, names: string[]): SearchResponse {
  const printings: SearchResponse["printings"] = {};
  const cards: SearchResponse["cards"] = {};
  for (const [index, name] of names.entries()) {
    printings[`p${index}`] = { cardId: `c${index}`, shortCode: `OGN-00${index}` } as never;
    cards[`c${index}`] = { name, slug: name.toLowerCase() } as never;
  }
  return {
    total,
    nextCursor: null,
    printingIds: names.map((_, index) => `p${index}`),
    printings,
    cards,
    sets: [],
  };
}

describe("buildSearchEmbed", () => {
  it("links each card and the full result page", () => {
    const embed = buildSearchEmbed({
      query: "d:fury",
      response: response(12, ["Garen", "Annie"]),
      siteUrl: SITE,
    });
    expect(embed.title).toBe("12 results for d:fury");
    expect(embed.url).toBe(searchPageUrl(SITE, "d:fury"));
    expect(embed.description).toBe(
      [
        `[Garen](${SITE}/cards/garen) · OGN-000`,
        `[Annie](${SITE}/cards/annie) · OGN-001`,
        "",
        `[10 more on OpenRift](${SITE}/cards?q=d%3Afury)`,
      ].join("\n"),
    );
  });

  it("says so when nothing matches", () => {
    const embed = buildSearchEmbed({ query: "t:unit", response: response(0, []), siteUrl: SITE });
    expect(embed.title).toBe("0 results for t:unit");
    expect(embed.description).toBe("Nothing matches.");
  });

  it("uses the singular for one result", () => {
    expect(
      buildSearchEmbed({ query: "x", response: response(1, ["Jinx"]), siteUrl: SITE }).title,
    ).toBe("1 result for x");
  });
});

describe("searchErrorText", () => {
  it("lists each problem in words", () => {
    expect(
      searchErrorText("d:purple e<=x", [
        { code: "badValue", key: "e", value: "x" },
        { code: "unknownValue", key: "domain", value: "purple" },
      ]),
    ).toBe(
      "Couldn't run “d:purple e<=x”:\n- “x” doesn't work with e:\n- No domain called “purple”",
    );
  });
});
