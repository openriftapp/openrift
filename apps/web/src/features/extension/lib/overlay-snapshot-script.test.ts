import type { CardmarketOverlaySnapshot } from "@openrift/shared/contracts/cardmarket-overlay";
import { describe, expect, it } from "vitest";

import { serializeOverlaySnapshot } from "./overlay-snapshot-script";

function snapshot(overrides: Partial<CardmarketOverlaySnapshot> = {}): CardmarketOverlaySnapshot {
  return {
    lists: [{ id: "5f4d3c2b-1a09-4877-8665-544332211009", name: "Summoner Skirmish pickups" }],
    marketplace: "cardmarket",
    generatedAt: "2026-09-09T12:30:00.000Z",
    products: [
      { idProduct: 903_066, finish: "normal", owned: 2, wanted: 4, priceCents: 249 },
      { idProduct: 903_066, finish: "foil", owned: 0, wanted: 1, priceCents: null },
    ],
    ...overrides,
  };
}

describe("serializeOverlaySnapshot", () => {
  it("round-trips the response through JSON.parse", () => {
    const source = snapshot();

    expect(JSON.parse(serializeOverlaySnapshot(source))).toEqual(source);
  });

  it("escapes every < so the text cannot close the script element", () => {
    const serialized = serializeOverlaySnapshot(
      snapshot({
        lists: [{ id: "5f4d3c2b-1a09-4877-8665-544332211009", name: "</script><img src=x>" }],
      }),
    );

    expect(serialized).not.toContain("<");
    expect(serialized).toContain(String.raw`\u003c/script>`);
  });

  it("keeps a name carrying markup intact after parsing", () => {
    const name = "</script><b>wish</b>";

    const parsed = JSON.parse(
      serializeOverlaySnapshot(
        snapshot({ lists: [{ id: "5f4d3c2b-1a09-4877-8665-544332211009", name }] }),
      ),
    ) as { lists: { name: string }[] };

    expect(parsed.lists.at(0)?.name).toBe(name);
  });

  it("serializes an empty product array", () => {
    const parsed = JSON.parse(serializeOverlaySnapshot(snapshot({ products: [] }))) as {
      products: unknown[];
    };

    expect(parsed.products).toEqual([]);
  });
});
