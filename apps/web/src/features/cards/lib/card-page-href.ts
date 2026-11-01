import type { Printing } from "@openrift/shared/types/catalog";
import type { RegisteredRouter } from "@tanstack/react-router";

/** Card page URL for one printing; grid printings carry no slug, so it links by `?printingId=`. */
export function cardPageHref(
  router: Pick<RegisteredRouter, "buildLocation">,
  printing: Pick<Printing, "printingId" | "cardId" | "side" | "otherSide"> & {
    card: Pick<Printing["card"], "slug">;
  },
): string {
  return router.buildLocation({
    to: "/cards/$cardSlug/{-$printingSlug}",
    params: { cardSlug: printing.card.slug, printingSlug: undefined },
    search: {
      printingId: printing.printingId,
      side: printing.side === 2 && printing.otherSide?.cardId === printing.cardId ? 2 : undefined,
    },
  }).href;
}
