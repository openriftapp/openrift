import { describe, expect, it } from "vitest";

import {
  headCanonical,
  headMeta,
  headTitle,
  loadedHead,
  runRouteHead,
  runRouteLoader,
} from "@/test/route-head";

import { Route } from "./collections_.share.$token";

const PARAMS = { token: "COLL123" };

function shared(description: string | null) {
  return {
    collection: {
      id: "col-1",
      name: "Binder",
      description,
      updatedAt: "2026-08-01T10:00:00.000Z",
      copyCount: 12,
    },
    items: [{ id: "copy-1" }, { id: "copy-2" }],
    nextCursor: "cursor",
    owner: { displayName: "Teemo Scout", gravatarHash: "hash" },
  };
}

describe("/collections/share/$token head", () => {
  it("credits the owner and versions the image by the copy count", async () => {
    const head = await loadedHead(Route, PARAMS, shared(null));

    expect(headTitle(head)).toBe("Binder (collection) - OpenRift");
    expect(headMeta(head, "description")).toBe(
      "A Riftbound card collection shared by Teemo Scout.",
    );
    expect(headMeta(head, "og:image")).toBe(
      "http://localhost:5173/api/v1/collections/share/COLL123/image.png?v=1785578400000-12-r2",
    );
    expect(headCanonical(head)).toBe("http://localhost:5173/collections/share/COLL123");
  });

  it("prefers the collection's own description", async () => {
    const head = await loadedHead(Route, PARAMS, shared("Foils only."));

    expect(headMeta(head, "description")).toBe("Foils only.");
  });

  it("keeps the copy rows out of the loader data", async () => {
    expect(await runRouteLoader(Route, PARAMS, shared(null))).toEqual({
      collection: {
        name: "Binder",
        description: null,
        updatedAt: "2026-08-01T10:00:00.000Z",
        copyCount: 12,
      },
      owner: { displayName: "Teemo Scout" },
    });
  });

  it("noindexes a link that no longer resolves", () => {
    const head = runRouteHead(Route, PARAMS, undefined);

    expect(headTitle(head)).toBe("Shared collection - OpenRift");
    expect(headMeta(head, "robots")).toBe("noindex, nofollow");
  });
});
