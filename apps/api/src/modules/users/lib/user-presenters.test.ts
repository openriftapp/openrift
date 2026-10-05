import { describe, expect, it } from "vitest";

import { toAdminUser, toFeatureFlag } from "./user-presenters.js";

const created = new Date("2026-03-01T10:00:00.000Z");

const user = {
  id: "u-1",
  email: "jinx@example.com",
  name: "Jinx",
  image: null,
  isAdmin: false,
  cardCount: 12,
  deckCount: 2,
  collectionCount: 3,
  listCount: 1,
  groups: [{ id: "g-1", name: "Zaun Crew" }],
  createdAt: created,
  lastActiveAt: new Date("2026-03-02T10:00:00.000Z"),
};

describe("toAdminUser", () => {
  it("serializes dates as ISO strings", () => {
    expect(toAdminUser(user)).toEqual({
      ...user,
      createdAt: "2026-03-01T10:00:00.000Z",
      lastActiveAt: "2026-03-02T10:00:00.000Z",
    });
  });

  it("keeps a never-active user's lastActiveAt null", () => {
    expect(toAdminUser({ ...user, lastActiveAt: null }).lastActiveAt).toBeNull();
  });
});

describe("toFeatureFlag", () => {
  it("maps a flag row", () => {
    expect(
      toFeatureFlag({
        key: "deck-builder",
        enabled: true,
        description: null,
        createdAt: created,
        updatedAt: created,
      }),
    ).toEqual({
      key: "deck-builder",
      enabled: true,
      description: null,
      createdAt: "2026-03-01T10:00:00.000Z",
      updatedAt: "2026-03-01T10:00:00.000Z",
    });
  });
});
