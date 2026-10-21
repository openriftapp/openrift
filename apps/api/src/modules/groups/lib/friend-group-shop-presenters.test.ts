import { describe, expect, it } from "vitest";

import {
  presentGroupShop,
  presentShopEvent,
  presentShopSearchResult,
} from "./friend-group-shop-presenters.js";

describe("presentGroupShop", () => {
  it("renders the next listing as an ISO instant", () => {
    expect(
      presentGroupShop({
        source: "uvsgames",
        storeId: "42",
        name: "FUNtainment Berlin",
        location: "79-83 Frankfurter Allee, Berlin, 10247, DE",
        upcomingCount: 8,
        nextEventAt: new Date("2026-09-11T15:00:00Z"),
      }),
    ).toEqual({
      shopKey: "uvsgames:42",
      source: "uvsgames",
      name: "FUNtainment Berlin",
      location: "79-83 Frankfurter Allee, Berlin, 10247, DE",
      upcomingCount: 8,
      nextEventAt: "2026-09-11T15:00:00.000Z",
    });
  });

  it("keeps a shop with nothing listed", () => {
    const shop = presentGroupShop({
      source: "playriftbound",
      storeId: "019f0000-0000-7000-8000-000000000001",
      name: "Dice Heart",
      location: null,
      upcomingCount: 0,
      nextEventAt: null,
    });
    expect(shop.shopKey).toBe("playriftbound:019f0000-0000-7000-8000-000000000001");
    expect(shop.nextEventAt).toBeNull();
    expect(shop.location).toBeNull();
  });
});

describe("presentShopSearchResult", () => {
  const row = {
    source: "uvsgames" as const,
    storeId: "42",
    name: "Dice Heart",
    location: null,
    upcomingCount: 3,
  };

  it("marks a shop the group already follows", () => {
    expect(presentShopSearchResult(row, new Set(["uvsgames:42"])).linked).toBe(true);
  });

  it("tells the same store id on another source apart", () => {
    expect(presentShopSearchResult(row, new Set(["playriftbound:42"])).linked).toBe(false);
  });
});

describe("presentShopEvent", () => {
  it("cites the uvsgames listing", () => {
    expect(
      presentShopEvent({
        source: "uvsgames",
        externalId: "9911",
        name: "Nexus Night",
        startAt: new Date("2026-09-11T15:00:00Z"),
        storeId: "42",
        storeName: "FUNtainment Berlin",
        eventFormat: "Constructed",
      }),
    ).toEqual({
      externalId: "9911",
      name: "Nexus Night",
      startAt: "2026-09-11T15:00:00.000Z",
      shopKey: "uvsgames:42",
      storeName: "FUNtainment Berlin",
      eventFormat: "Constructed",
      url: "https://locator.riftbound.uvsgames.com/events/9911",
    });
  });

  it("cites the playriftbound listing and labels its format", () => {
    expect(
      presentShopEvent({
        source: "playriftbound",
        externalId: "117000000000000001",
        name: "Radiance Pre-Rift",
        startAt: new Date("2026-10-18T15:00:00Z"),
        storeId: "org-1",
        storeName: "Bandle City Games",
        eventFormat: "LIMITED_SEALED",
      }),
    ).toMatchObject({
      shopKey: "playriftbound:org-1",
      eventFormat: "Sealed",
      url: "https://playriftbound.com/en-US/events/117000000000000001",
    });
  });
});
