import type { Printing } from "@openrift/shared/types/catalog";
import { useRouter } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { CardCountStrip } from "@/features/cards/components/card-count-strip";
import { CardThumbnail } from "@/features/cards/components/card-thumbnail";
import type { CardThumbnailDisplay } from "@/features/cards/hooks/use-card-thumbnail-display";
import { cardPageHref } from "@/features/cards/lib/card-page-href";

const PROMOS_CARD_SIZES =
  "(min-width: 2560px) 261px, (min-width: 2160px) 211px, (min-width: 1720px) 217px, (min-width: 1280px) 230px, (min-width: 1024px) calc((100vw - 296px) / 3 - 12px), (min-width: 640px) calc((100vw - 56px) / 3 - 12px), calc((100vw - 40px) / 2 - 12px)";

function MarkerChips({ printing }: { printing: Printing }) {
  if (printing.markers.length === 0) {
    return null;
  }
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {printing.markers.map((marker) => (
        <Badge key={marker.id} variant="secondary" title={marker.description ?? undefined}>
          {marker.label}
        </Badge>
      ))}
    </div>
  );
}

export function PromoCardThumbnail({
  printing,
  showImages,
  display,
  ownedCounts,
  onClick,
}: {
  printing: Printing;
  showImages: boolean;
  display: CardThumbnailDisplay;
  ownedCounts: Record<string, number> | undefined;
  onClick: (printing: Printing) => void;
}) {
  const router = useRouter();
  const ownedCount = ownedCounts?.[printing.printingId] ?? 0;
  return (
    <CardThumbnail
      printing={printing}
      onClick={onClick}
      href={cardPageHref(router, printing)}
      showImages={showImages}
      display={display}
      sizes={PROMOS_CARD_SIZES}
      belowLabel={<MarkerChips printing={printing} />}
      aboveCard={ownedCounts ? <CardCountStrip count={ownedCount} /> : undefined}
      dimmed={ownedCounts ? ownedCount === 0 : undefined}
    />
  );
}
