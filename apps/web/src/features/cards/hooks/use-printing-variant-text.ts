import { formatPrintingVariantLabelParts } from "@openrift/shared/printing-label";
import type { Printing } from "@openrift/shared/types/catalog";

import { useEnumOrders } from "@/hooks/use-enums";
import { m } from "@/paraglide/messages.js";

export function usePrintingVariantText(): (
  printing: Printing,
  siblings?: readonly Printing[],
) => string {
  const { labels } = useEnumOrders();
  return (printing, siblings) => {
    const { language, rest, otherSide, otherSideIsSelf } = formatPrintingVariantLabelParts(
      printing,
      siblings,
      {
        ...labels,
        flags: { overnumbered: m.cards_flag_overnumbered(), signed: m.cards_flag_signed() },
        onOneSide: (part) => m.cards_printing_part_one_side({ part }),
      },
    );
    const parts = [printing.shortCode, ...(language ? [language] : []), ...rest];
    if (otherSide) {
      parts.push(
        otherSideIsSelf
          ? m.cards_printing_same_both_sides({ name: otherSide })
          : m.cards_printing_with_side({ name: otherSide }),
      );
    }
    return parts.join(" · ");
  };
}
