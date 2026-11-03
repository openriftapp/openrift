import { marketplaceLabel } from "@openrift/shared/marketplace";
import { Suspense } from "react";
import type { ReactNode } from "react";

import { usePrices } from "@/features/cards/hooks/use-prices";
import { useOwnedCountsForPrintings } from "@/features/collections/hooks/use-owned-count";
import { useHydrated } from "@/hooks/use-hydrated";
import { useUserId } from "@/hooks/use-session";
import { formatPrice, formatterForMarketplace, priceColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useDisplayStore } from "@/stores/display-store";

export interface CellStats {
  owned?: Record<string, number>;
  price: (printingId: string) => ReactNode;
}

/**
 * Renders `children` without stats until prices and owned counts load.
 * They have no server snapshot, so they only join after hydration.
 */
export function WithPrintingStats({
  printingIds,
  children,
}: {
  printingIds: string[];
  children: (stats?: CellStats) => ReactNode;
}) {
  const hydrated = useHydrated();
  if (!hydrated) {
    return children();
  }
  return (
    <Suspense fallback={children()}>
      <LiveStats printingIds={printingIds}>{children}</LiveStats>
    </Suspense>
  );
}

function LiveStats({
  printingIds,
  children,
}: {
  printingIds: string[];
  children: (stats: CellStats) => ReactNode;
}) {
  const userId = useUserId();
  const prices = usePrices();
  const marketplaceOrder = useDisplayStore((s) => s.marketplaceOrder);
  const { data: owned } = useOwnedCountsForPrintings(printingIds, Boolean(userId));

  const price = (printingId: string) => {
    const marketplace = marketplaceOrder.find(
      (candidate) => prices.get(printingId, candidate) !== undefined,
    );
    const value = marketplace === undefined ? undefined : prices.get(printingId, marketplace);
    if (marketplace === undefined || value === undefined) {
      return <span className="text-muted-foreground/60">{formatPrice()}</span>;
    }
    return (
      <span className={priceColorClass(value)} title={marketplaceLabel(marketplace)}>
        {formatterForMarketplace(marketplace)(value)}
      </span>
    );
  };

  return children({ owned: owned?.totals, price });
}

export function OwnedPill({ count = 0, floating }: { count?: number; floating?: boolean }) {
  if (count === 0) {
    return null;
  }
  return (
    <span
      className={cn(
        "bg-foreground text-background ring-card text-2xs flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 font-semibold tabular-nums ring-2",
        floating && "absolute -top-1.5 -right-1.5",
      )}
    >
      ×{count}
    </span>
  );
}
