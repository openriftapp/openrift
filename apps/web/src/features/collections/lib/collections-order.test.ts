import type { CollectionResponse } from "@openrift/shared/types/api/collection";
import { describe, expect, it } from "vitest";

import { stubCollection } from "@/test/factories";

import { compareCollections } from "./collections-order";

function ids(collections: CollectionResponse[]): string[] {
  return collections.toSorted(compareCollections).map((row) => row.id);
}

describe("compareCollections", () => {
  it("puts personal collections before group collections", () => {
    expect(
      ids([
        stubCollection({ id: "pool", groupId: "g1", groupName: "Bandle City" }),
        stubCollection({ id: "binder" }),
      ]),
    ).toEqual(["binder", "pool"]);
  });

  it("orders group collections by their group's name", () => {
    expect(
      ids([
        stubCollection({ id: "zaun-pool", groupId: "g2", groupName: "Zaun Skirmish" }),
        stubCollection({ id: "bandle-pool", groupId: "g1", groupName: "Bandle City" }),
      ]),
    ).toEqual(["bandle-pool", "zaun-pool"]);
  });

  it("puts the inbox first, then orders by sort order, then by name", () => {
    expect(
      ids([
        stubCollection({ id: "trades", name: "Trades", sortOrder: 2 }),
        stubCollection({ id: "binder-b", name: "Binder B", sortOrder: 1 }),
        stubCollection({ id: "binder-a", name: "Binder A", sortOrder: 1 }),
        stubCollection({ id: "inbox", name: "Inbox", isInbox: true, sortOrder: 5 }),
      ]),
    ).toEqual(["inbox", "binder-a", "binder-b", "trades"]);
  });
});
