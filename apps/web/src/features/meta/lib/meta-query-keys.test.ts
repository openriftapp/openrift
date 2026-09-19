import { describe, expect, it } from "vitest";

import { metaKeys } from "./meta-query-keys";

describe("metaKeys", () => {
  it("decks keys the whole archive when no window is given", () => {
    expect(metaKeys.decks()).toEqual(["meta", "decks"]);
  });

  it("decks reads an empty window as the whole archive", () => {
    expect(metaKeys.decks({})).toEqual(metaKeys.decks());
  });

  it("decks keys each window apart", () => {
    expect(metaKeys.decks({ from: "2026-01-01", to: "2026-06-30" })).not.toEqual(
      metaKeys.decks({ from: "2026-07-01" }),
    );
  });

  it("decks keeps an open end apart from a closed one", () => {
    expect(metaKeys.decks({ from: "2026-01-01" })).toEqual([
      "meta",
      "decks",
      {
        from: "2026-01-01",
        to: null,
        formats: null,
        formatsEx: null,
        tiers: null,
        tiersEx: null,
        countries: null,
        countriesEx: null,
        legend: null,
        player: null,
        events: null,
        legends: null,
        maxRank: null,
        curated: null,
        by: null,
        dir: null,
        limit: null,
        offset: null,
      },
    ]);
  });

  it("decks keys each page, order and narrowing apart", () => {
    expect(metaKeys.decks({ offset: 0 })).not.toEqual(metaKeys.decks({ offset: 50 }));
    expect(metaKeys.decks({ by: "finish" })).not.toEqual(metaKeys.decks({ by: "date" }));
    expect(metaKeys.decks({ curated: true })).not.toEqual(metaKeys.decks());
    expect(metaKeys.decks({ events: ["rift-open"] })).not.toEqual(
      metaKeys.decks({ events: ["summoner-skirmish"] }),
    );
    expect(metaKeys.decks({ maxRank: 8 })).not.toEqual(metaKeys.decks({ maxRank: 4 }));
  });

  it("deck facets ignore the page the browser is on", () => {
    expect(metaKeys.deckFacets({ curated: true })).not.toEqual(metaKeys.deckFacets());
  });

  it("decks keys a facet include apart from the matching exclude", () => {
    expect(metaKeys.decks({ tiers: ["premier"] })).not.toEqual(
      metaKeys.decks({ tiersEx: ["premier"] }),
    );
    expect(metaKeys.decks({ countries: ["DE"] })).not.toEqual(
      metaKeys.decks({ countries: ["FR"] }),
    );
  });

  it("decks keys the legend, the player and the cap apart", () => {
    expect(metaKeys.decks({ legend: "card-1" })).not.toEqual(metaKeys.decks({ legend: "card-2" }));
    expect(metaKeys.decks({ player: "renata" })).not.toEqual(metaKeys.decks({ player: "ekko" }));
    expect(metaKeys.decks({ limit: 12 })).not.toEqual(metaKeys.decks({ limit: 24 }));
  });

  it("the event index keys the whole archive when nothing narrows it", () => {
    expect(metaKeys.eventPage()).toEqual(["meta", "event-page"]);
    expect(metaKeys.eventPage({})).toEqual(metaKeys.eventPage());
  });

  it("the event index keys the page, the sort and the filter apart", () => {
    expect(metaKeys.eventPage({ q: "worlds" })).not.toEqual(metaKeys.eventPage({ q: "regional" }));
    expect(metaKeys.eventPage({ by: "players" })).not.toEqual(metaKeys.eventPage({ by: "date" }));
    expect(metaKeys.eventPage({ offset: 50 })).not.toEqual(metaKeys.eventPage({ offset: 100 }));
  });

  it("keeps a page of the index and the facet counts under their own bases", () => {
    const filter = { q: "worlds" };

    expect(metaKeys.eventPage(filter)[1]).toBe("event-page");
    expect(metaKeys.eventFacets(filter)[1]).toBe("event-facets");
  });

  it("the facet counts ignore the page and the sort, which do not change them", () => {
    expect(metaKeys.eventFacets({ q: "worlds" })).toEqual(
      metaKeys.eventFacets({ q: "worlds", by: "players", offset: 50 } as never),
    );
  });

  it("counts keys the unfiltered archive plainly", () => {
    expect(metaKeys.counts()).toEqual(["meta", "counts"]);
    expect(metaKeys.counts({ format: "constructed" })).toEqual([
      "meta",
      "counts",
      { format: "constructed", dateFrom: null, dateTo: null },
    ]);
  });

  it("legend keys an unscoped page under the slug alone", () => {
    expect(metaKeys.legend("kennen")).toEqual(["meta", "legends", "kennen"]);
    expect(metaKeys.legend("kennen", {})).toEqual(metaKeys.legend("kennen"));
  });

  it("legend keys each facet and page apart", () => {
    expect(metaKeys.legend("kennen", { tiers: ["premier"] })).not.toEqual(
      metaKeys.legend("kennen", { tiersEx: ["premier"] }),
    );
    expect(metaKeys.legend("kennen", { page: 2 })).not.toEqual(
      metaKeys.legend("kennen", { page: 3 }),
    );
    expect(metaKeys.legend("kennen", { page: 2 })).not.toEqual(
      metaKeys.legend("ekko", { page: 2 }),
    );
  });

  it("legends keys each scope apart, the unscoped index plainly", () => {
    expect(metaKeys.legends()).toEqual(["meta", "legends"]);
    expect(metaKeys.legends({ tiers: ["premier"] })).not.toEqual(
      metaKeys.legends({ tiers: ["local"] }),
    );
  });

  it("deckCards keys under its own base, one event apart from another", () => {
    expect(metaKeys.deckCards()).toEqual(["meta", "deck-cards"]);
    expect(metaKeys.deckCards({ event: "summoner-skirmish" })).not.toEqual(
      metaKeys.deckCards({ event: "regional-lyon" }),
    );
  });

  it("deckCards keys each page of the browser apart, so one page never prices another", () => {
    expect(metaKeys.deckCards({ limit: 50, offset: 0 })).not.toEqual(
      metaKeys.deckCards({ limit: 50, offset: 50 }),
    );
    expect(metaKeys.deckCards({ limit: 50, offset: 0, curated: true })).not.toEqual(
      metaKeys.deckCards({ limit: 50, offset: 0 }),
    );
  });

  it("eventPage keys one named event apart, so the two submit routes never share a page", () => {
    expect(metaKeys.eventPage({ slug: "summoner-skirmish", limit: 1 })).not.toEqual(
      metaKeys.eventPage({ slug: "regional-lyon", limit: 1 }),
    );
    expect(metaKeys.eventPage({ slug: "summoner-skirmish", limit: 1 })).not.toEqual(
      metaKeys.eventPage({ limit: 1 }),
    );
  });
});
