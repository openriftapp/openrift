import { describe, expect, it } from "vitest";

import {
  headCanonical,
  headMeta,
  headTitle,
  loadedHead,
  runRouteHead,
  runRouteLoader,
} from "@/test/route-head";

import { Route } from "./lists_.share.$token";

const PARAMS = { token: "LIST123" };

const SHARED = {
  list: { id: "list-1", name: "Wants", intent: "wish", updatedAt: "2026-08-01T10:00:00.000Z" },
  entries: [{ id: "entry-1" }, { id: "entry-2" }],
  owner: { displayName: "Teemo Scout", gravatarHash: "hash" },
};

describe("/lists/share/$token head", () => {
  it("names the list by its kind and credits the owner", async () => {
    const head = await loadedHead(Route, PARAMS, SHARED);

    expect(headTitle(head)).toBe("Wants (wish list) - OpenRift");
    expect(headMeta(head, "description")).toBe("A Riftbound wish list shared by Teemo Scout.");
    expect(headMeta(head, "og:image")).toBe(
      "http://localhost:5173/api/v1/lists/share/LIST123/image.png?v=1785578400000",
    );
    expect(headCanonical(head)).toBe("http://localhost:5173/lists/share/LIST123");
  });

  it("keeps the entry rows out of the loader data", async () => {
    expect(await runRouteLoader(Route, PARAMS, SHARED)).toEqual({
      list: { name: "Wants", intent: "wish", updatedAt: "2026-08-01T10:00:00.000Z" },
      owner: { displayName: "Teemo Scout" },
    });
  });

  it("noindexes a link that no longer resolves", () => {
    const head = runRouteHead(Route, PARAMS, undefined);

    expect(headTitle(head)).toBe("Shared list - OpenRift");
    expect(headMeta(head, "robots")).toBe("noindex, nofollow");
  });
});
