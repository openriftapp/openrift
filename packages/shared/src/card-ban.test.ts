import { afterEach, describe, expect, it, vi } from "vitest";

import { isBanInEffect, splitCardBans } from "./card-ban";
import { makeCard } from "./test-factories";

function ban(bannedAt: string, formatId = "standard") {
  return { formatId, formatName: formatId, bannedAt, reason: null };
}

describe("isBanInEffect", () => {
  it("takes effect on its start day", () => {
    expect(isBanInEffect(ban("2026-09-18"), "2026-09-18")).toBe(true);
  });

  it("is not in effect the day before it starts", () => {
    expect(isBanInEffect(ban("2026-09-18"), "2026-09-17")).toBe(false);
  });

  it("stays in effect after its start day", () => {
    expect(isBanInEffect(ban("2026-03-31"), "2026-09-17")).toBe(true);
  });
});

describe("splitCardBans", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves bans that start after today into upcomingBans", () => {
    const current = ban("2026-03-31");
    const scheduled = ban("2026-09-18", "2v2");
    const card = splitCardBans({ ...makeCard(), bans: [current, scheduled] }, "2026-09-15");
    expect(card.bans).toEqual([current]);
    expect(card.upcomingBans).toEqual([scheduled]);
  });

  it("keeps the card's other fields", () => {
    const card = splitCardBans(
      { ...makeCard({ name: "Jinx, Rebel" }), id: "card-1" },
      "2026-09-15",
    );
    expect(card).toMatchObject({ id: "card-1", name: "Jinx, Rebel", bans: [], upcomingBans: [] });
  });

  it("switches at UTC midnight when no day is given", () => {
    const card = { ...makeCard(), bans: [ban("2026-09-18")] };
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T23:59:59.000Z"));
    expect(splitCardBans(card).bans).toEqual([]);
    vi.setSystemTime(new Date("2026-09-18T00:00:00.000Z"));
    expect(splitCardBans(card).bans).toEqual(card.bans);
  });
});
