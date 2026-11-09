import { getOrientation } from "@openrift/shared/card-orientation";
import type { Printing } from "@openrift/shared/types/catalog";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { Suspense, lazy, useState } from "react";

import { CardIcon } from "@/components/card-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { CardPriceChip } from "@/features/cards/components/card-price-chip";
import { usePrices } from "@/features/cards/hooks/use-prices";
import { formatterForMarketplace } from "@/lib/format";
import { useDisplayStore } from "@/stores/display-store";

import { ImageCreditLine } from "./image-credit";
import { PriceTable } from "./pricing";

const DETAIL_RANGES = ["7d", "30d", "all"] as const;

const PriceHistoryChart = lazy(async () => {
  const m = await import("@/features/cards/components/price-history-chart");
  return { default: m.PriceHistoryChart };
});

function ChartSkeleton() {
  return (
    <div data-testid="price-chart-skeleton" className="space-y-3">
      <Skeleton className="h-8 w-full rounded-lg" />
      <Skeleton className="aspect-[2.5/1] w-full rounded-lg" />
    </div>
  );
}

export function CardCredits({ printing }: { printing: Printing }) {
  const frontImage = printing.images[0];
  return (
    <>
      <p className="text-muted-foreground flex items-center gap-1 text-xs">
        <CardIcon src="/images/artist.svg" className="size-3.5" />
        {printing.artist}
      </p>
      {frontImage?.credit !== undefined && <ImageCreditLine credit={frontImage.credit} />}
    </>
  );
}

export function CardArtPrice({ printing }: { printing: Printing }) {
  const favorite = useDisplayStore((s) => s.marketplaceOrder[0]);
  const price = usePrices().get(printing.printingId, favorite);
  if (price === undefined) {
    return null;
  }
  return (
    <CardPriceChip
      text={formatterForMarketplace(favorite)(price)}
      isLandscape={getOrientation(printing.card.types) === "landscape"}
    />
  );
}

export function CardFooter({
  printing,
  showPrices = true,
}: {
  printing: Printing;
  showPrices?: boolean;
}) {
  const marketplaceOrder = useDisplayStore((s) => s.marketplaceOrder);
  const favorite = marketplaceOrder[0];
  const [source, setSource] = useState<Marketplace>(favorite);
  const prices = usePrices();
  const hasPrice = showPrices && prices.get(printing.printingId, favorite) !== undefined;

  return (
    <div className="mt-2 space-y-2">
      <CardCredits printing={printing} />
      {showPrices && <PriceTable printing={printing} selected={source} onSelect={setSource} />}
      {hasPrice && (
        <Suspense fallback={<ChartSkeleton />}>
          <PriceHistoryChart
            printingId={printing.printingId}
            ranges={DETAIL_RANGES}
            source={source}
          />
        </Suspense>
      )}
    </div>
  );
}
