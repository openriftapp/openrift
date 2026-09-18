import type { PublicDeckCardResponse } from "@openrift/shared/types/api/deck";
import type { MetaDeckDetailResponse } from "@openrift/shared/types/api/meta";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/site-config", () => ({ getSiteUrl: () => "https://openrift.test" }));

const { metaDeckCopyFields } = await import("./meta-deck-copy");

const TOKEN = "aB3dE5gH7jK9";

const legendCard = {
  cardId: "card-vex",
  zone: "legend",
  quantity: 1,
  cardName: "Gloomist",
  cardSlug: "gloomist",
  cardTypes: ["legend"],
  tags: ["Vex"],
  domains: ["chaos", "calm"],
} as unknown as PublicDeckCardResponse;

const mainCard = {
  cardId: "card-a",
  zone: "main",
  quantity: 3,
  cardName: "Punch First",
  cardSlug: "punch-first",
  cardTypes: ["spell"],
  tags: [],
  domains: ["fury"],
} as unknown as PublicDeckCardResponse;

const EVENT: MetaDeckDetailResponse["meta"]["event"] = {
  slug: "summoner-skirmish-2026",
  name: "Summoner Skirmish",
  eventDate: "2026-08-01",
  format: "standard",
  tier: "competitive",
  country: null,
  playerCount: 64,
};

function detail(
  overrides: Partial<MetaDeckDetailResponse["meta"]> = {},
  cards: PublicDeckCardResponse[] = [legendCard, mainCard],
): Pick<MetaDeckDetailResponse, "deck" | "cards" | "meta"> {
  return {
    deck: { name: "Gloomist (Ana)" } as MetaDeckDetailResponse["deck"],
    cards,
    meta: {
      event: EVENT,
      listStatus: "full",
      playerName: "Ana",
      playerKey: "u1001",
      rank: 2,
      rankIsTier: false,
      wins: 6,
      losses: 2,
      draws: null,
      contributors: [],
      ...overrides,
    },
  };
}

describe("metaDeckCopyFields", () => {
  it("names the copy after the champion-led legend and the player", () => {
    expect(metaDeckCopyFields(detail(), TOKEN).name).toBe("Vex, Gloomist (Ana)");
  });

  it("drops the player from the name when the archive has none", () => {
    expect(metaDeckCopyFields(detail({ playerName: "" }), TOKEN).name).toBe("Vex, Gloomist");
  });

  it("keeps the archived deck name when the list has no legend or champion", () => {
    expect(metaDeckCopyFields(detail({}, [mainCard]), TOKEN).name).toBe("Gloomist (Ana)");
  });

  it("describes the event, player, placement and record with links back", () => {
    expect(metaDeckCopyFields(detail(), TOKEN).description).toBe(
      "Ana played this deck at [Summoner Skirmish](https://openrift.test/meta/summoner-skirmish-2026) on 2026-08-01. Finish: 2nd, record 6-2-0.\n\n" +
        "[View the original list in the meta archive](https://openrift.test/meta/decks/aB3dE5gH7jK9)",
    );
  });

  it("leaves out the record when the archive has none and prints a tier rank as a tier", () => {
    const { description } = metaDeckCopyFields(
      detail({ wins: null, losses: null, rank: 8, rankIsTier: true }),
      TOKEN,
    );
    expect(description).toContain("Finish: T8.");
    expect(description).not.toContain("record");
  });

  it("starts without a player when the archive has no player name", () => {
    const { description } = metaDeckCopyFields(detail({ playerName: "" }), TOKEN);
    expect(description).toMatch(/^Played at \[Summoner Skirmish\]/u);
  });

  it("escapes brackets in the event name so the link stays intact", () => {
    const { description } = metaDeckCopyFields(
      detail({ event: { ...EVENT, name: "Skirmish [Day 2]" } }),
      TOKEN,
    );
    expect(description).toContain(String.raw`[Skirmish \[Day 2\]](https://openrift.test/meta/`);
  });
});
