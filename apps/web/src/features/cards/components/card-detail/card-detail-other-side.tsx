import type { Printing, PrintingOtherSide } from "@openrift/shared/types/catalog";
import type { ReactNode } from "react";

import { DoubleSidedFlip } from "@/features/cards/components/double-sided-flip";
import { useCards } from "@/features/cards/hooks/use-cards";

export function CardDetailOtherSide({
  printing,
  otherSide,
  onSelect,
  children,
}: {
  printing: Printing;
  otherSide: PrintingOtherSide;
  onSelect: (printing: Printing) => void;
  children: ReactNode;
}) {
  const { printingsByCardId } = useCards();
  const entry = printingsByCardId
    .get(otherSide.cardId)
    ?.find((p) => p.printingId === printing.printingId && p.side !== printing.side);
  if (!entry) {
    return children;
  }
  return (
    <DoubleSidedFlip key={printing.cardId} otherSide={otherSide} onFlip={() => onSelect(entry)}>
      {children}
    </DoubleSidedFlip>
  );
}
