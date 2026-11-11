import { CARDMARKET_WANTS_URL, CARDTRADER_WISHLIST_URL } from "@openrift/shared/marketplace";
import { describe, expect, it } from "vitest";

import type { HandoffItem } from "./marketplace-handoff";
import { marketplaceHandoff } from "./marketplace-handoff";

const JINX: HandoffItem = {
  printingId: "p-1",
  quantity: 2,
  name: "Jinx, Rebel",
  language: "FR",
  finish: "foil",
};
const STAR: HandoffItem = { printingId: "p-2", quantity: 1, name: "Star Spring" };
const NO_PRINTING: HandoffItem = { quantity: 3, name: "Cleave" };

const productIds: Record<string, number | null> = { "p-1": 652_993, "p-2": null };
const productIdOf = (printingId: string) => productIds[printingId];

function massEntryEntries(href: string): string | null {
  const target = new URL(new URL(href).searchParams.get("u") ?? "");
  return target.searchParams.get("c");
}

describe("marketplaceHandoff", () => {
  it("sends TCGplayer the listed printings through Mass Entry and counts the rest as unlisted", () => {
    const handoff = marketplaceHandoff("tcgplayer", [JINX, STAR, NO_PRINTING], productIdOf);
    expect(handoff).toMatchObject({ kind: "cart", marketplace: "tcgplayer", sent: 2, unlisted: 2 });
    expect(handoff.kind === "cart" && massEntryEntries(handoff.href)).toBe("2-652993");
  });

  it("sends CardNexus the listed printings with language and finish", () => {
    const handoff = marketplaceHandoff("cardnexus", [JINX, STAR], productIdOf);
    expect(handoff).toEqual({
      kind: "cart",
      marketplace: "cardnexus",
      href: "https://af.cardnexus.link/7018965/products/cn/652993.2.fr.f",
      sent: 2,
      unlisted: 1,
    });
  });

  it("sends nothing when no printing has a product id yet", () => {
    const handoff = marketplaceHandoff("tcgplayer", [JINX, STAR], () => undefined);
    expect(handoff).toMatchObject({ kind: "cart", sent: 0, unlisted: 2 });
  });

  it("hands Cardmarket a wants list by name, including cards without a printing", () => {
    expect(marketplaceHandoff("cardmarket", [STAR, JINX, NO_PRINTING], productIdOf)).toEqual({
      kind: "paste",
      marketplace: "cardmarket",
      href: CARDMARKET_WANTS_URL,
      text: "3x Cleave\n2x Jinx, Rebel\n1x Star Spring",
    });
  });

  it("hands CardTrader a wishlist by name", () => {
    expect(marketplaceHandoff("cardtrader", [STAR, JINX], productIdOf)).toEqual({
      kind: "paste",
      marketplace: "cardtrader",
      href: CARDTRADER_WISHLIST_URL,
      text: "2 Jinx, Rebel\n1 Star Spring",
    });
  });
});
