import { describe, expect, it } from "vitest";

import {
  headCanonical,
  headMeta,
  headTitle,
  loadedHead,
  runRouteHead,
  runRouteLoader,
} from "@/test/route-head";

import { Route } from "./tier-lists_.share.$token";

const PARAMS = { token: "TIER123" };

function shared(description: string | null) {
  return {
    tierList: {
      id: "tier-1",
      title: "Best units",
      description,
      updatedAt: "2026-08-01T10:00:00.000Z",
      tiers: [{ cards: ["card-a", "card-b"] }, { cards: ["card-c"] }],
    },
    owner: { displayName: "Teemo Scout", gravatarHash: "hash" },
  };
}

describe("/tier-lists/share/$token head", () => {
  it("counts the ranked cards when the tier list has no description", async () => {
    const head = await loadedHead(Route, PARAMS, shared(null));

    expect(headTitle(head)).toBe("Best units - OpenRift");
    expect(headMeta(head, "description")).toBe(
      "A Riftbound tier list by Teemo Scout, ranking 3 cards.",
    );
    expect(headMeta(head, "og:image")).toBe(
      "http://localhost:5173/api/v1/tier-lists/share/TIER123/image.png?v=1785578400000",
    );
    expect(headCanonical(head)).toBe("http://localhost:5173/tier-lists/share/TIER123");
  });

  it("prefers the tier list's own description", async () => {
    const head = await loadedHead(Route, PARAMS, shared("Season one picks."));

    expect(headMeta(head, "description")).toBe("Season one picks.");
  });

  it("keeps the tiers out of the loader data", async () => {
    expect(await runRouteLoader(Route, PARAMS, shared(null))).toEqual({
      tierList: { title: "Best units", description: null, updatedAt: "2026-08-01T10:00:00.000Z" },
      owner: { displayName: "Teemo Scout" },
      rankedCount: 3,
    });
  });

  it("noindexes a link that no longer resolves", () => {
    const head = runRouteHead(Route, PARAMS, undefined);

    expect(headTitle(head)).toBe("Shared tier list - OpenRift");
    expect(headMeta(head, "robots")).toBe("noindex, nofollow");
  });
});
