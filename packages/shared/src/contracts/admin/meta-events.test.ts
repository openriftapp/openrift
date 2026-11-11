import { describe, expect, it } from "vitest";

import { adminMetaEventListQuerySchema } from "./meta-events.js";

describe("adminMetaEventListQuerySchema", () => {
  it("accepts relevance with a search term", () => {
    expect(
      adminMetaEventListQuerySchema.safeParse({ search: "Summoner Skirmish", sort: "relevance" })
        .success,
    ).toBe(true);
  });

  it("rejects relevance without a search term", () => {
    expect(adminMetaEventListQuerySchema.safeParse({ sort: "relevance" }).success).toBe(false);
    expect(
      adminMetaEventListQuerySchema.safeParse({ search: "  ", sort: "relevance" }).success,
    ).toBe(false);
  });

  it("rejects relevance with a direction", () => {
    expect(
      adminMetaEventListQuerySchema.safeParse({
        search: "Summoner Skirmish",
        sort: "relevance",
        direction: "asc",
      }).success,
    ).toBe(false);
  });

  it("accepts a column sort with a direction and no search", () => {
    expect(
      adminMetaEventListQuerySchema.safeParse({ sort: "name", direction: "asc" }).success,
    ).toBe(true);
  });
});
