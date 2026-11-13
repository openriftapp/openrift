import { describe, expect, it } from "vitest";

import {
  headCanonical,
  headMeta,
  headTitle,
  loadedHead,
  runRouteHead,
  runRouteLoader,
} from "@/test/route-head";

import { Route } from "./users_.share.$token_.lists.$listId";

const PARAMS = { token: "BUNDLE123", listId: "list-1" };

const SHARED = {
  list: { id: "list-1", name: "Haves", intent: "trade", updatedAt: "2026-08-01T10:00:00.000Z" },
  entries: [{ id: "entry-1" }],
  owner: { displayName: "Teemo Scout", gravatarHash: "hash" },
};

describe("/users/share/$token/lists/$listId head", () => {
  it("previews with the owner's bundle image, busted by this list's updates", async () => {
    const head = await loadedHead(Route, PARAMS, SHARED);

    expect(headTitle(head)).toBe("Haves (Tradelist) - OpenRift");
    expect(headMeta(head, "description")).toBe("A Riftbound tradelist shared by Teemo Scout.");
    expect(headMeta(head, "og:image")).toBe(
      "http://localhost:5173/api/v1/users/share/BUNDLE123/image.png?v=1785578400000-r2",
    );
    expect(headCanonical(head)).toBe("http://localhost:5173/users/share/BUNDLE123/lists/list-1");
  });

  it("keeps the entry rows out of the loader data", async () => {
    expect(await runRouteLoader(Route, PARAMS, SHARED)).toEqual({
      list: { name: "Haves", intent: "trade", updatedAt: "2026-08-01T10:00:00.000Z" },
      owner: { displayName: "Teemo Scout" },
    });
  });

  it("noindexes a link that no longer resolves", () => {
    const head = runRouteHead(Route, PARAMS, undefined);

    expect(headTitle(head)).toBe("Shared list - OpenRift");
    expect(headMeta(head, "robots")).toBe("noindex, nofollow");
  });
});
