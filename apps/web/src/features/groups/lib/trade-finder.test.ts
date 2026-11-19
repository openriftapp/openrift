import { describe, expect, it } from "vitest";

import { finderPeople } from "./trade-finder";
import type { TradeMarketCard, TradeMarketSource } from "./trade-market";

function source(userId: string, name: string): TradeMarketSource {
  return { userId, name, image: null, gravatarHash: "hash", groupNames: ["Summoner Skirmish"] };
}

function card(
  direction: TradeMarketCard["direction"],
  printingId: string,
  sources: TradeMarketSource[],
): TradeMarketCard {
  return {
    direction,
    printingId,
    cardId: `card-${printingId}`,
    sources,
    rows: sources.map((entry) => ({
      counterpartyUserId: entry.userId,
      groupSlug: "summoner-skirmish",
      groupName: "Summoner Skirmish",
    })) as TradeMarketCard["rows"],
  };
}

const ash = source("user-ash", "Ash");
const robin = source("user-robin", "Robin");

describe("finderPeople", () => {
  it("returns nobody without suggestions", () => {
    expect(finderPeople([], [])).toEqual([]);
  });

  it("splits each person's cards into what they could give and what they want", () => {
    const [person] = finderPeople(
      [card("incoming", "p1", [ash]), card("incoming", "p2", [ash])],
      [card("outgoing", "p3", [ash])],
    );
    expect(person?.userId).toBe("user-ash");
    expect(person?.get.map((entry) => entry.printingId)).toEqual(["p1", "p2"]);
    expect(person?.give.map((entry) => entry.printingId)).toEqual(["p3"]);
  });

  it("narrows a shared card to the one person", () => {
    const people = finderPeople([card("incoming", "p1", [ash, robin])], []);
    expect(people.map((person) => person.get[0]?.sources.map((entry) => entry.userId))).toEqual([
      ["user-ash"],
      ["user-robin"],
    ]);
  });

  it("keeps a one-way match with an empty other side", () => {
    const [person] = finderPeople([], [card("outgoing", "p1", [robin])]);
    expect(person?.get).toEqual([]);
    expect(person?.give).toHaveLength(1);
  });

  it("puts the person with the most matches first, then by name", () => {
    const people = finderPeople(
      [
        card("incoming", "p1", [robin]),
        card("incoming", "p2", [ash]),
        card("incoming", "p3", [ash]),
      ],
      [card("outgoing", "p4", [robin])],
    );
    expect(people.map((person) => person.name)).toEqual(["Ash", "Robin"]);
  });
});
