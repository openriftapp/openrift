import { buildCardIndex, lookupCard } from "@openrift/shared/card-search";
import { describe, expect, it } from "vitest";

import { cardTieReply } from "./card-tie-reply.js";

const index = buildCardIndex(
  [
    { id: "c1", slug: "jinx-rebel", name: "Jinx, Rebel", types: [], tags: [] },
    { id: "c2", slug: "jinx-loose-cannon", name: "Jinx, Loose Cannon", types: [], tags: [] },
    { id: "c3", slug: "viktor", name: "Viktor", types: [], tags: [] },
  ],
  new Map(),
);

describe("cardTieReply", () => {
  it("names the cards a typed name ties between", () => {
    const found = lookupCard(index, "jinx");
    expect(found.status).toBe("tied");
    const cards = found.status === "tied" ? found.cards : [];

    expect(cardTieReply("jinx", cards)).toBe(
      "“jinx” matches 2 cards: Jinx, Loose Cannon | Jinx, Rebel. Pick one from the name suggestions.",
    );
  });

  it("caps the list and counts the rest", () => {
    const cards = Array.from({ length: 7 }, (_, i) => ({
      name: `Jinx ${String(i + 1)}`,
      types: [],
      tags: [],
    }));

    const reply = cardTieReply("jinx", cards);

    expect(reply).toContain("Jinx 5 and 2 more.");
    expect(reply.split(" | ")).toHaveLength(5);
  });

  it("keeps an absurdly long query and long names inside a Discord message", () => {
    const cards = Array.from({ length: 5 }, (_, i) => ({
      name: `${"x".repeat(500)}${String(i)}`,
      types: [],
      tags: [],
    }));

    expect(cardTieReply("q".repeat(5000), cards).length).toBeLessThanOrEqual(2000);
  });

  it("leaves a unique typed name and a slug as single matches", () => {
    expect(lookupCard(index, "viktor").status).toBe("found");
    expect(lookupCard(index, "jinx-rebel").status).toBe("found");
  });
});
