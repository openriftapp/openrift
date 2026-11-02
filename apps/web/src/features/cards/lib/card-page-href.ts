import type { Printing } from "@openrift/shared/types/catalog";
import type { RegisteredRouter } from "@tanstack/react-router";
import { linkOptions } from "@tanstack/react-router";

type CardPagePrinting = Pick<Printing, "printingId" | "cardId" | "side" | "otherSide"> & {
  card: Pick<Printing["card"], "slug">;
};

/** Grid printings carry no slug, so the card page selects the printing by `?printingId=`. */
export function cardPageSearch(printing: Omit<CardPagePrinting, "card">) {
  return {
    printingId: printing.printingId,
    side: printing.side === 2 && printing.otherSide?.cardId === printing.cardId ? 2 : undefined,
  } as const;
}

export function cardPageLinkOptions(printing: CardPagePrinting) {
  return linkOptions({
    to: "/cards/$cardSlug/{-$printingSlug}",
    params: { cardSlug: printing.card.slug, printingSlug: undefined },
    search: cardPageSearch(printing),
  });
}

export function cardPageHref(
  router: Pick<RegisteredRouter, "buildLocation">,
  printing: CardPagePrinting,
): string {
  return router.buildLocation(cardPageLinkOptions(printing)).href;
}
