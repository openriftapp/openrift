import { describe, expect, it } from "vitest";

import {
  headCanonical,
  headMeta,
  headTitle,
  loadedHead,
  runRouteHead,
  runRouteLoader,
} from "@/test/route-head";

import { Route } from "./board.$token";

const PARAMS = { token: "BOARD123" };

function shared(summary: string | null) {
  return {
    boardState: {
      id: "board-1",
      title: "Lethal on turn five?",
      summary,
      updatedAt: "2026-08-01T10:00:00.000Z",
      state: { zones: [{ cards: ["card-a"] }] },
    },
    owner: { displayName: "Teemo Scout", gravatarHash: "hash" },
  };
}

describe("/board/$token head", () => {
  it("credits the owner when the board has no summary", async () => {
    const head = await loadedHead(Route, PARAMS, shared(null));

    expect(headTitle(head)).toBe("Lethal on turn five? - OpenRift");
    expect(headMeta(head, "description")).toBe("A Riftbound board state by Teemo Scout.");
    expect(headMeta(head, "og:image")).toBe(
      "http://localhost:5173/api/v1/board-states/share/BOARD123/image.png?v=1785578400000-r2",
    );
    expect(headCanonical(head)).toBe("http://localhost:5173/board/BOARD123");
  });

  it("prefers the board's own summary", async () => {
    const head = await loadedHead(Route, PARAMS, shared("Find the line."));

    expect(headMeta(head, "description")).toBe("Find the line.");
  });

  it("keeps the board itself out of the loader data", async () => {
    expect(await runRouteLoader(Route, PARAMS, shared(null))).toEqual({
      boardState: {
        title: "Lethal on turn five?",
        summary: null,
        updatedAt: "2026-08-01T10:00:00.000Z",
      },
      owner: { displayName: "Teemo Scout" },
    });
  });

  it("noindexes a link that no longer resolves", () => {
    const head = runRouteHead(Route, PARAMS, undefined);

    expect(headTitle(head)).toBe("Board state - OpenRift");
    expect(headMeta(head, "robots")).toBe("noindex, nofollow");
  });
});
