import { describe, expect, it } from "vitest";

import { toCustomTag, toPublicCustomTag } from "./custom-tag-presenters.js";

const AT = new Date("2026-03-17T00:00:00.000Z");

const ROW = {
  id: "t-1",
  slug: "piltover",
  label: "Piltover",
  category: "region",
  categoryLabel: "Region",
  categoryId: "c-1",
  description: null,
  sortOrder: 2,
  createdAt: AT,
  updatedAt: AT,
};

describe("toCustomTag", () => {
  it("maps a tag row with its card count", () => {
    const at = new Date("2026-03-17T00:00:00.000Z");
    expect(
      toCustomTag(
        {
          id: "t-1",
          slug: "piltover",
          label: "Piltover",
          category: "region",
          categoryLabel: "Region",
          categoryId: "c-1",
          description: null,
          sortOrder: 2,
          createdAt: at,
          updatedAt: at,
        },
        7,
      ),
    ).toEqual({
      id: "t-1",
      slug: "piltover",
      label: "Piltover",
      category: "region",
      categoryLabel: "Region",
      categoryId: "c-1",
      description: null,
      sortOrder: 2,
      cardCount: 7,
      createdAt: "2026-03-17T00:00:00.000Z",
      updatedAt: "2026-03-17T00:00:00.000Z",
    });
  });
});

describe("toPublicCustomTag", () => {
  it("drops the category id and timestamps", () => {
    expect(toPublicCustomTag(ROW)).toEqual({
      id: "t-1",
      slug: "piltover",
      label: "Piltover",
      category: "region",
      categoryLabel: "Region",
      description: null,
      sortOrder: 2,
    });
  });
});
