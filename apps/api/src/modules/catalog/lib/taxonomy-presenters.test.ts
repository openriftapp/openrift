import { describe, expect, it } from "vitest";

import {
  toDistributionChannelResponse,
  toLanguageResponse,
  toMarkerResponse,
  toTagCategoryResponse,
} from "./taxonomy-presenters.js";

const createdAt = new Date("2026-03-17T00:00:00.000Z");
const updatedAt = new Date("2026-03-18T12:30:00.000Z");

describe("toTagCategoryResponse", () => {
  it("maps the row with the given tag count and ISO timestamps", () => {
    expect(
      toTagCategoryResponse(
        {
          id: "cat-1",
          slug: "species",
          label: "Species",
          description: null,
          sortOrder: 2,
          createdAt,
          updatedAt,
        },
        5,
      ),
    ).toEqual({
      id: "cat-1",
      slug: "species",
      label: "Species",
      description: null,
      sortOrder: 2,
      tagCount: 5,
      createdAt: "2026-03-17T00:00:00.000Z",
      updatedAt: "2026-03-18T12:30:00.000Z",
    });
  });
});

describe("toMarkerResponse", () => {
  it("maps the row with ISO timestamps", () => {
    expect(
      toMarkerResponse({
        id: "m-1",
        slug: "top-8",
        label: "Top 8",
        description: "Placed top 8",
        sortOrder: 0,
        createdAt,
        updatedAt,
      }),
    ).toEqual({
      id: "m-1",
      slug: "top-8",
      label: "Top 8",
      description: "Placed top 8",
      sortOrder: 0,
      createdAt: "2026-03-17T00:00:00.000Z",
      updatedAt: "2026-03-18T12:30:00.000Z",
    });
  });
});

describe("toLanguageResponse", () => {
  it("drops isWellKnown and maps ISO timestamps", () => {
    expect(
      toLanguageResponse({
        code: "en",
        name: "English",
        color: "#112233",
        sortOrder: 1,
        isWellKnown: true,
        createdAt,
        updatedAt,
      }),
    ).toEqual({
      code: "en",
      name: "English",
      color: "#112233",
      sortOrder: 1,
      createdAt: "2026-03-17T00:00:00.000Z",
      updatedAt: "2026-03-18T12:30:00.000Z",
    });
  });
});

describe("toDistributionChannelResponse", () => {
  it("maps the row with the given printing count", () => {
    expect(
      toDistributionChannelResponse(
        {
          id: "dc-1",
          slug: "regional",
          label: "Regional",
          description: null,
          kind: "event",
          sortOrder: 3,
          parentId: "dc-0",
          childrenLabel: null,
          createdAt,
          updatedAt,
        },
        7,
      ),
    ).toEqual({
      id: "dc-1",
      slug: "regional",
      label: "Regional",
      description: null,
      kind: "event",
      sortOrder: 3,
      parentId: "dc-0",
      childrenLabel: null,
      createdAt: "2026-03-17T00:00:00.000Z",
      updatedAt: "2026-03-18T12:30:00.000Z",
      printingCount: 7,
    });
  });
});
