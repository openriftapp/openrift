import { enumLabel } from "@openrift/shared/enum-label";
import { marketplaceLabel } from "@openrift/shared/marketplace";
import { snapshotHeadline } from "@openrift/shared/types/api/pricing";
import type { Printing } from "@openrift/shared/types/catalog";
import type { Marketplace, TimeRange } from "@openrift/shared/types/pricing";
import { ALL_MARKETPLACES, MARKETPLACE_CURRENCY } from "@openrift/shared/types/pricing";
import { WellKnown } from "@openrift/shared/well-known";
import { lazy, Suspense, useState } from "react";

import { Heading } from "@/components/heading";
import { LanguageChip } from "@/components/language-chip";
import { ExpandToggle } from "@/components/ui/expand-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { PriceTable, PriceTablePlaceholder } from "@/features/cards/components/card-detail/pricing";
import { usePriceHistory } from "@/features/cards/hooks/use-price-history";
import { TIME_RANGES } from "@/features/cards/lib/price-history-chart-constants";
import { useEnumOrders } from "@/hooks/use-enums";
import { useHydrated } from "@/hooks/use-hydrated";
import { formatPublicCode, formatterForMarketplace } from "@/lib/format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

const PriceHistoryChart = lazy(async () => {
  const mod = await import("@/features/cards/components/price-history-chart");
  return { default: mod.PriceHistoryChart };
});

export function PriceHistorySection({ printing }: { printing: Printing }) {
  const hydrated = useHydrated();
  const marketplaceOrder = useDisplayStore((s) => s.marketplaceOrder);
  const [source, setSource] = useState<Marketplace>(marketplaceOrder[0]);
  const { data } = usePriceHistory(printing.printingId, "all");
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [range, setRange] = useState<TimeRange>("30d");
  const [showDaily, setShowDaily] = useState(false);
  const { labels } = useEnumOrders();

  const { data: rangeData } = usePriceHistory(printing.printingId, range);

  const hasAnyData =
    data &&
    ALL_MARKETPLACES.some((mp) => {
      const mpData = data[mp];
      return mpData?.available && mpData.snapshots.length > 0;
    });

  if (data && !hasAnyData) {
    return null;
  }

  const heading = (
    <Heading level={2} className="mb-3">
      {m.card_detail_prices_title()} · {formatPublicCode(printing)}
      {printing.finish !== WellKnown.finish.NORMAL &&
        ` ${enumLabel(labels.finishes, printing.finish)}`}
      {printing.markers.length > 0 &&
        ` (${printing.markers.map((marker) => marker.label).join(", ")})`}
      {printing.language !== WellKnown.language.EN && (
        <>
          {" "}
          <LanguageChip code={printing.language} />
        </>
      )}
    </Heading>
  );
  const placeholder = <PriceTablePlaceholder selected={source} onSelect={setSource} hideHeading />;
  const priceTable = (
    <div className="xl:w-90 xl:shrink-0">
      {hydrated ? (
        <Suspense fallback={placeholder}>
          <PriceTable
            printing={printing}
            selected={source}
            onSelect={setSource}
            keepEmptyRows
            hideHeading
          />
        </Suspense>
      ) : (
        placeholder
      )}
    </div>
  );

  if (!data) {
    return (
      <section>
        {heading}
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
          {priceTable}
          <Skeleton className="aspect-[2.5/1] w-full rounded-lg xl:flex-1" />
        </div>
      </section>
    );
  }

  const allSnapshots = data?.[source]?.snapshots;
  const spanSnapshots = allSnapshots && allSnapshots.length >= 2 ? allSnapshots : undefined;
  const firstSnapshot = spanSnapshots?.[0];
  const lastSnapshot = spanSnapshots?.at(-1);
  const dataSpanDays =
    firstSnapshot && lastSnapshot
      ? Math.round(
          (new Date(lastSnapshot.date).getTime() - new Date(firstSnapshot.date).getTime()) /
            86_400_000,
        )
      : null;

  const availableRanges = TIME_RANGES.filter(
    (tr) => tr.days === 0 || dataSpanDays === null || dataSpanDays >= tr.days,
  );

  const effectiveRange = availableRanges.some((tr) => tr.value === range)
    ? range
    : ("all" as TimeRange);

  const dateMap = new Map<string, Partial<Record<Marketplace, number>>>();
  if (rangeData) {
    for (const mp of ALL_MARKETPLACES) {
      const mpData = rangeData[mp];
      if (!mpData?.available) {
        continue;
      }
      for (const snap of mpData.snapshots) {
        const entry = dateMap.get(snap.date) ?? {};
        entry[mp] = snapshotHeadline(snap);
        dateMap.set(snap.date, entry);
      }
    }
  }
  const tableRows = [...dateMap.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, prices]) => ({ date, ...prices }));

  const availableMarketplaces = rangeData
    ? marketplaceOrder.filter((mp) => rangeData[mp]?.available)
    : [];

  return (
    <section>
      {heading}
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        {priceTable}
        <div className="min-w-0 xl:flex-1">
          <Suspense fallback={<Skeleton className="aspect-[2.5/1] w-full rounded-lg" />}>
            <PriceHistoryChart
              printingId={printing.printingId}
              range={effectiveRange}
              onRangeChange={setRange}
              source={source}
              highlightedDate={hoveredDate}
              onDateHover={setHoveredDate}
            />
          </Suspense>
        </div>
      </div>
      {tableRows.length > 0 && (
        <div className="mt-4">
          <ExpandToggle
            expanded={showDaily}
            onClick={() => setShowDaily((open) => !open)}
            className="text-muted-foreground gap-1.5 text-sm"
          >
            {m.card_detail_daily_prices()}
          </ExpandToggle>
          {showDaily && (
            // contain-inline-size: without it the table's intrinsic width leaks up the
            // flex column and widens the page past a phone viewport.
            <div className="mt-2 max-h-[400px] overflow-auto contain-inline-size">
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr className="border-border bg-background border-b">
                    <th scope="col" className="px-3 py-2 text-left font-medium">
                      {m.card_detail_price_date()}
                    </th>
                    {availableMarketplaces.map((mp) => (
                      <th
                        key={mp}
                        scope="col"
                        className={cn(
                          "px-3 py-2 text-right font-medium whitespace-nowrap",
                          mp !== source && "text-muted-foreground",
                        )}
                      >
                        {marketplaceLabel(mp)} ({MARKETPLACE_CURRENCY[mp]})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr
                      key={row.date}
                      className={cn("transition-colors", hoveredDate === row.date && "bg-muted")}
                      onMouseEnter={() => setHoveredDate(row.date)}
                      onMouseLeave={() => setHoveredDate(null)}
                    >
                      <td className="text-muted-foreground px-3 py-1.5 whitespace-nowrap">
                        {row.date}
                      </td>
                      {availableMarketplaces.map((mp) => {
                        const value = row[mp];
                        const fmt = formatterForMarketplace(mp);
                        return (
                          <td
                            key={mp}
                            className={cn(
                              "px-3 py-1.5 text-right tabular-nums",
                              mp !== source && "text-muted-foreground",
                            )}
                          >
                            {value === undefined ? "—" : fmt(value)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
