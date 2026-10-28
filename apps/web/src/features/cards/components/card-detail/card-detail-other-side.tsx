import { sideKey } from "@openrift/shared/printing-side";
import type { Printing, PrintingOtherSide } from "@openrift/shared/types/catalog";
import type { ReactNode } from "react";

import { DoubleSidedFlip } from "@/features/cards/components/double-sided-flip";
import { useCards } from "@/features/cards/hooks/use-cards";
import { otherSideOf } from "@/features/cards/lib/printing-designs";

import { CardDetailArt } from "./card-detail-art";

export function CardDetailOtherSide({
  printing,
  otherSide,
  showImages,
  onSelect,
  children,
}: {
  printing: Printing;
  otherSide: PrintingOtherSide;
  showImages?: boolean;
  onSelect: (printing: Printing) => void;
  children: ReactNode;
}) {
  const { printingsByCardId } = useCards();
  const entry = otherSideOf(printing, printingsByCardId.get(otherSide.cardId) ?? []);
  if (!entry) {
    return children;
  }
  return (
    <DoubleSidedFlip
      key={sideKey(printing)}
      otherSide={otherSide}
      back={<CardDetailArt printing={entry} showImages={showImages} disableTilt />}
      onFlip={() => onSelect(entry)}
    >
      {children}
    </DoubleSidedFlip>
  );
}
