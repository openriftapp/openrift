import { describe, expect, it } from "vitest";

import {
  headCanonical,
  headMeta,
  headTitle,
  loadedHead,
  runRouteHead,
  runRouteLoader,
} from "@/test/route-head";

import { Route } from "./decks_.share.$token";

const PARAMS = { token: "DECK123" };

function shared(
  description: string | null,
  format = "constructed",
  displayName: string | null = "Teemo Scout",
) {
  return {
    deck: {
      id: "deck-1",
      name: "Jinx Aggro",
      format,
      description,
      updatedAt: "2026-08-01T10:00:00.000Z",
    },
    cards: [{ cardId: "card-jinx", quantity: 3 }],
    owner: { displayName, gravatarHash: "hash" },
    plan: null,
    planCardMeta: [],
    customTagAssignments: {},
    catalog: { cards: {}, printings: {} },
  };
}

describe("/decks/share/$token head", () => {
  it("titles the deck with its format and credits the owner", async () => {
    const head = await loadedHead(Route, PARAMS, shared(null));

    expect(headTitle(head)).toBe("Jinx Aggro (Constructed deck) - OpenRift");
    expect(headMeta(head, "description")).toBe(
      "A Constructed Riftbound deck shared by Teemo Scout.",
    );
    expect(headMeta(head, "og:image")).toBe(
      "http://localhost:5173/api/v1/decks/share/DECK123/image.png?v=1785578400000",
    );
    expect(headMeta(head, "robots")).toBe("noindex, nofollow");
    expect(headCanonical(head)).toBe("http://localhost:5173/decks/share/DECK123");
  });

  it("titles the deck with the admin-managed format label", async () => {
    const head = await loadedHead(Route, PARAMS, shared(null, "custom-region"));

    expect(headTitle(head)).toBe("Jinx Aggro (Custom Region deck) - OpenRift");
  });

  it("omits the byline when the owner has no name", async () => {
    const head = await loadedHead(Route, PARAMS, shared(null, "constructed", null));

    expect(headMeta(head, "description")).toBe("A Constructed Riftbound deck.");
  });

  it("prefers the deck's own description", async () => {
    const head = await loadedHead(Route, PARAMS, shared("Burn them down."));

    expect(headMeta(head, "description")).toBe("Burn them down.");
  });

  it("keeps the card rows out of the loader data", async () => {
    expect(await runRouteLoader(Route, PARAMS, shared(null))).toEqual({
      deck: {
        name: "Jinx Aggro",
        description: null,
        updatedAt: "2026-08-01T10:00:00.000Z",
      },
      formatLabel: "Constructed",
      owner: { displayName: "Teemo Scout" },
    });
  });

  it("noindexes a link that no longer resolves", () => {
    const head = runRouteHead(Route, PARAMS, undefined);

    expect(headTitle(head)).toBe("Shared deck - OpenRift");
    expect(headMeta(head, "robots")).toBe("noindex, nofollow");
  });
});
