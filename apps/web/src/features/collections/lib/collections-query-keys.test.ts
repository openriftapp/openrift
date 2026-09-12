import { describe, expect, it } from "vitest";

import { collectionsKeys, copiesKeys } from "./collections-query-keys";

describe("collectionsKeys", () => {
  it("all keys per user", () => {
    expect(collectionsKeys.all("user-1")).toEqual(["collections", "user-1"]);
  });
});

describe("copiesKeys", () => {
  it("all keys per user", () => {
    expect(copiesKeys.all("user-1")).toEqual(["copies", "user-1"]);
  });

  it("syncedStore keys per user under the copies prefix", () => {
    expect(copiesKeys.syncedStore("user-1")).toEqual(["copies", "user-1", "store"]);
  });

  it("listMemberships keys per (user, copyIds) with a null exclude slot by default", () => {
    expect(copiesKeys.listMemberships("user-1", ["c1", "c2"])).toEqual([
      "copies",
      "user-1",
      "list-memberships",
      ["c1", "c2"],
      null,
    ]);
  });

  it("listMemberships distinguishes an excludeListId so the 'Sold' check caches separately", () => {
    expect(copiesKeys.listMemberships("user-1", ["c1"], "lst-9")).toEqual([
      "copies",
      "user-1",
      "list-memberships",
      ["c1"],
      "lst-9",
    ]);
  });
});
