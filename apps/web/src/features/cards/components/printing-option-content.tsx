import { getOrientation } from "@openrift/shared/card-orientation";
import type { Printing } from "@openrift/shared/types/catalog";
import type { ReactNode } from "react";

import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import { usePreferredPrinting } from "@/features/cards/hooks/use-preferred-printing";
import { frontImageId } from "@/features/cards/lib/card-meta";
import { cn } from "@/lib/utils";

/** Fixed strip frame keeps row height stable when landscape and portrait cards mix in one list. */
export function PrintingThumbnail({
  printing,
  className,
}: {
  printing: Printing;
  className?: string;
}) {
  const thumb = (
    <CardArtThumb
      shape="strip"
      imageId={frontImageId(printing)}
      landscape={getOrientation(printing.card.types) === "landscape"}
      rarity={printing.rarity}
      domains={printing.card.domains}
      className={className ?? "h-10"}
      loading="lazy"
    />
  );
  if (!printing.otherSide) {
    return thumb;
  }
  return (
    <span className="relative mr-1 inline-flex shrink-0">
      <CardArtThumb
        shape="strip"
        imageId={printing.otherSide.imageId}
        className={cn(className ?? "h-10", "absolute -top-1 left-1 opacity-70")}
        loading="lazy"
      />
      {thumb}
    </span>
  );
}

export function PreferredPrintingThumbnail({
  cardId,
  className,
}: {
  cardId: string;
  className?: string;
}) {
  const { getPreferredPrinting } = usePreferredPrinting();
  const printing = getPreferredPrinting(cardId);
  if (!printing) {
    return <CardArtThumb shape="strip" className={className ?? "h-10"} />;
  }
  const { otherSide: _otherSide, ...cardPrinting } = printing;
  return <PrintingThumbnail printing={cardPrinting} className={className} />;
}

export function cardSearchLeading(cardId: string): ReactNode {
  return <PreferredPrintingThumbnail cardId={cardId} className="h-8" />;
}
