import { describe, expect, it } from "vitest";

import {
  headCanonical,
  headMeta,
  headTitle,
  loadedHead,
  runRouteHead,
  runRouteLoader,
} from "@/test/route-head";

import { Route } from "./users_.share.$token";

const PARAMS = { token: "BUNDLE123" };

const BUNDLE = {
  owner: { displayName: "Teemo Scout", gravatarHash: "hash", bio: "Bandle City trader" },
  groupsInCommon: [{ slug: "bandle" }],
  lists: [
    { id: "l-1", name: "A", intent: "wish", entryCount: 3, updatedAt: "2026-08-01T10:00:00.000Z" },
    { id: "l-2", name: "B", intent: "trade", entryCount: 5, updatedAt: "2026-09-01T10:00:00.000Z" },
    { id: "l-3", name: "C", intent: "wish", entryCount: 1, updatedAt: "2026-07-01T10:00:00.000Z" },
  ],
};

describe("/users/share/$token head", () => {
  it("counts the lists and cards, and versions the image by the newest list and the list count", async () => {
    const head = await loadedHead(Route, PARAMS, BUNDLE);

    expect(headTitle(head)).toBe("Teemo Scout's wishlists and tradelists - OpenRift");
    expect(headMeta(head, "description")).toBe("2 wishlists, 1 tradelist, 9 cards in total.");
    expect(headMeta(head, "og:image")).toBe(
      "http://localhost:5173/api/v1/users/share/BUNDLE123/image.png?v=1788256800000-3-r2",
    );
    expect(headCanonical(head)).toBe("http://localhost:5173/users/share/BUNDLE123");
  });

  it("keeps the profile and list rows down to what the head reads", async () => {
    expect(await runRouteLoader(Route, PARAMS, BUNDLE)).toEqual({
      owner: { displayName: "Teemo Scout" },
      lists: [
        { intent: "wish", entryCount: 3, updatedAt: "2026-08-01T10:00:00.000Z" },
        { intent: "trade", entryCount: 5, updatedAt: "2026-09-01T10:00:00.000Z" },
        { intent: "wish", entryCount: 1, updatedAt: "2026-07-01T10:00:00.000Z" },
      ],
    });
  });

  it("noindexes a link that no longer resolves", () => {
    const head = runRouteHead(Route, PARAMS, undefined);

    expect(headTitle(head)).toBe("Shared lists - OpenRift");
    expect(headMeta(head, "robots")).toBe("noindex, nofollow");
  });
});
