import { legendDisplayName } from "@openrift/shared/card-name";
import type { Printing } from "@openrift/shared/types/catalog";
import { useState } from "react";
import type { ReactNode } from "react";

import { DoubleSidedFlip } from "@/features/cards/components/double-sided-flip";
import { useCards } from "@/features/cards/hooks/use-cards";
import { otherSideOf } from "@/features/cards/lib/printing-designs";
import { cn } from "@/lib/utils";

import { CardDetailArt } from "./card-detail-art";

export function PrintingArt({
  printing,
  showImages,
  sizes,
  frame,
}: {
  printing: Printing;
  showImages?: boolean;
  sizes: string;
  frame: (art: ReactNode) => ReactNode;
}) {
  const { printingsByCardId } = useCards();
  const [showBack, setShowBack] = useState(false);
  const other = printing.otherSide;
  const backEntry = other
    ? otherSideOf(printing, printingsByCardId.get(other.cardId) ?? [])
    : undefined;

  const art = (shown: Printing) => (
    <div className={cn(shown.images.length === 0 && "opacity-60")}>
      <CardDetailArt printing={shown} showImages={showImages} sizes={sizes} loading="lazy" />
    </div>
  );
  const front = art(printing);
  const back = backEntry && art(backEntry);
  const framed = frame(showBack && back ? back : front);

  if (!other || !backEntry) {
    return framed;
  }
  const flipTarget = showBack ? printing : backEntry;
  return (
    <DoubleSidedFlip
      key={String(showBack)}
      otherSide={{ ...other, cardName: legendDisplayName(flipTarget.card) }}
      back={showBack ? front : back}
      onFlip={() => setShowBack(!showBack)}
    >
      {framed}
    </DoubleSidedFlip>
  );
}
