import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PackPrinting, PackResult } from "@/features/pack-opener/lib/pack-types";
import { stubPriceLookup } from "@/test/factories";

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ rarityColors: {}, labels: { rarities: {} } }),
}));

const { PackStats } = await import("./pack-stats");

function pack(printingId: string): PackResult {
  const printing: PackPrinting = {
    id: printingId,
    printingId,
    cardId: `${printingId}-card`,
    cardName: "Jinx",
    cardSlug: "jinx",
    cardTypes: ["unit"],
    cardSuperTypes: [],
    tags: [],
    rarity: "common",
    finish: "normal",
    artVariant: "normal",
    isSigned: false,
    isOvernumbered: false,
    language: "EN",
    shortCode: "OGN-001",
    publicCode: "OGN-001",
    setSlug: "ogn",
  };
  return { pulls: [{ slot: "common", outcome: "common", printing }] };
}

describe("PackStats", () => {
  it("values the packs in the given marketplace and counts the unpriced pulls", () => {
    render(
      <PackStats
        packs={[pack("p1"), pack("p2")]}
        prices={stubPriceLookup({ p1: { tcgplayer: 3, cardmarket: 2 } })}
        marketplace="tcgplayer"
      />,
    );

    expect(screen.getByText("$3.00 total")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "(1 without price data)" })).toBeInTheDocument();
  });
});
