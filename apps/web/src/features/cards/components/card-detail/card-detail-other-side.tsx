import { imageUrl } from "@openrift/shared/image-url";
import type { Printing, PrintingOtherSide } from "@openrift/shared/types/catalog";

import { Pressable } from "@/components/ui/pressable";
import { useCards } from "@/features/cards/hooks/use-cards";
import { m } from "@/paraglide/messages.js";

export function CardDetailOtherSide({
  printing,
  otherSide,
  onSelect,
}: {
  printing: Printing;
  otherSide: PrintingOtherSide;
  onSelect: (printing: Printing) => void;
}) {
  const { printingsByCardId } = useCards();
  const entry = printingsByCardId
    .get(otherSide.cardId)
    ?.find((p) => p.printingId === printing.printingId && p.side !== printing.side);
  if (!entry) {
    return null;
  }
  return (
    <Pressable
      onClick={() => onSelect(entry)}
      className="text-muted-foreground hover:text-foreground flex items-center gap-3 text-left text-sm"
    >
      {otherSide.imageId && (
        <img
          src={imageUrl(otherSide.imageId, "120w")}
          alt=""
          width={48}
          height={67}
          className="w-12 shrink-0 rounded-md"
        />
      )}
      {m.cards_printing_double_sided({ name: otherSide.cardName })}
    </Pressable>
  );
}
