import { describe, expect, it } from "vitest";

import { headMeta, headTitle, loadedHead, runRouteLoader } from "@/test/route-head";

import { Route } from "./meta_.decks_.$token";

const PARAMS = { token: "PNID1X7995W0" };

const LEGEND_CARD = {
  cardId: "card-1",
  cardSlug: "blade-dancer",
  cardName: "Blade Dancer",
  cardTypes: ["legend"],
  superTypes: [],
  domains: ["calm", "chaos"],
  tags: ["Irelia"],
  zone: "legend",
  quantity: 1,
  preferredPrintingId: null,
};

function archivedDeck(overrides: { cards?: unknown[]; playerName?: string } = {}) {
  return {
    deck: {
      name: "Blade Dancer (adtoll)",
      format: "constructed",
      updatedAt: "2026-08-29T10:00:00.000Z",
    },
    cards: overrides.cards ?? [LEGEND_CARD],
    meta: {
      playerName: overrides.playerName ?? "adtoll",
      rank: 1,
      rankIsTier: false,
      event: { slug: "wuhan-open", name: "Wuhan Open", eventDate: "2026-08-29" },
    },
  };
}

function runHead(overrides: { cards?: unknown[]; playerName?: string } = {}) {
  return loadedHead(Route, PARAMS, archivedDeck(overrides));
}

describe("/meta/decks/$token SSR head", () => {
  it("titles the page by the legend, never by the generated deck name", async () => {
    const head = await runHead();
    expect(headTitle(head)).toContain("Irelia, Blade Dancer, 1st at Wuhan Open");
    expect(headTitle(head)).not.toContain("Blade Dancer (adtoll)");
  });

  it("names the legend the player piloted in the description", async () => {
    expect(headMeta(await runHead(), "description")).toBe(
      "adtoll piloted Irelia, Blade Dancer to 1st at Wuhan Open (2026-08-29).",
    );
  });

  it("names the deck format with its admin-managed label", async () => {
    const head = await loadedHead(Route, PARAMS, {
      ...archivedDeck({ cards: [] }),
      deck: { name: "x", format: "custom-region", updatedAt: "2026-08-29T10:00:00.000Z" },
    });
    expect(headMeta(head, "description")).toBe(
      "adtoll piloted this Custom Region deck to 1st at Wuhan Open (2026-08-29).",
    );
  });

  it("falls back to the player for a list whose source published no legend", async () => {
    const head = await runHead({ cards: [] });
    expect(headTitle(head)).toContain("adtoll, 1st at Wuhan Open");
    expect(headMeta(head, "description")).toBe(
      "adtoll piloted this Constructed deck to 1st at Wuhan Open (2026-08-29).",
    );
  });

  it("unfurls with the deck's own image rather than the site's", async () => {
    expect(headMeta(await runHead(), "og:image")).toContain("/decks/share/PNID1X7995W0/image.png");
  });

  it("ends the breadcrumb on the same name the title uses", async () => {
    const head = await runHead();
    const crumbs = head.scripts?.[0]?.children ?? "";
    expect(crumbs).toContain("Irelia, Blade Dancer");
    expect(crumbs).not.toContain("Blade Dancer (adtoll)");
  });
});

describe("/meta/decks/$token loader", () => {
  it("keeps the card rows out of the loader data", async () => {
    expect(await runRouteLoader(Route, PARAMS, archivedDeck())).toEqual({
      deck: { updatedAt: "2026-08-29T10:00:00.000Z" },
      formatLabel: "Constructed",
      meta: {
        playerName: "adtoll",
        rank: 1,
        rankIsTier: false,
        event: { slug: "wuhan-open", name: "Wuhan Open", eventDate: "2026-08-29" },
      },
      legend: "Irelia, Blade Dancer",
    });
  });
});
