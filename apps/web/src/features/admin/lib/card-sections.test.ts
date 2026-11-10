import { describe, expect, it } from "vitest";

import { cardSectionsFor, navSectionOf } from "./card-sections";

describe("cardSectionsFor", () => {
  it("lists no attention section, it lives inside Fields & faces", () => {
    expect(cardSectionsFor(true)).toEqual([
      "overview",
      "printings",
      "marketplace",
      "bans",
      "history",
    ]);
  });

  it("hides the admin-only sections from grant holders", () => {
    expect(cardSectionsFor(false)).toEqual(["overview", "printings"]);
  });
});

describe("navSectionOf", () => {
  it("shows an attention link in Fields & faces", () => {
    expect(navSectionOf("attention")).toBe("printings");
  });

  it("keeps every other section", () => {
    expect(navSectionOf("history")).toBe("history");
  });
});
