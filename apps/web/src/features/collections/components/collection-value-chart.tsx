import { formatDay } from "@openrift/shared/format-date";
import { marketplaceLabel } from "@openrift/shared/marketplace";
import type { CompletionScopePreference } from "@openrift/shared/types/api/preferences";
import type { Marketplace, TimeRange } from "@openrift/shared/types/pricing";
import { CircleXIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import { MarketplaceIcon } from "@/components/marketplace-icon";
import { Alert, AlertTitle } from "@/components/ui/alert";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCollectionValueHistory } from "@/features/collections/hooks/use-collection-value-history";
import { describePriceChange, formatterForMarketplace } from "@/lib/format";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

function timeRanges(): { value: TimeRange; label: string }[] {
  return [
    { value: "7d", label: "7D" },
    { value: "30d", label: "30D" },
    { value: "90d", label: "90D" },
    { value: "all", label: m.common_all() },
  ];
}

// --chart-2, not the neutral --chart-3: gold/gray falls under the ΔE 15
// contrast floor in dark mode, gold/teal clears it.
function buildChartConfig(): ChartConfig {
  return {
    value: { label: m.collections_stats_value_series_value(), color: "var(--chart-1)" },
    baselineValue: {
      label: m.collections_stats_value_series_baseline(),
      color: "var(--chart-2)",
    },
  } satisfies ChartConfig;
}

interface CollectionValueTooltipContentProps {
  active?: boolean;
  payload?: {
    payload: { date: string; value: number; baselineValue: number; copyCount: number };
  }[];
  currencyFormatter: (value: number) => string;
}

function CollectionValueTooltipContent({
  active,
  payload,
  currencyFormatter,
}: CollectionValueTooltipContentProps) {
  const [firstEntry] = payload ?? [];
  if (!active || firstEntry === undefined) {
    return null;
  }
  const point = firstEntry.payload;
  // Body ink, not red/green: those are the reserved status colors, and the
  // sign already carries the direction.
  const { sign, magnitude, percent } = describePriceChange(point.value, point.baselineValue);
  return (
    <div className="border-border/50 bg-background rounded-lg border px-2.5 py-1.5 text-xs shadow-md">
      <p className="mb-1 font-medium">{formatDay(point.date)}</p>
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ backgroundColor: "var(--color-value)" }} />
          <span className="text-muted-foreground">{m.collections_stats_value_series_value()}</span>
          <span className="ml-auto font-mono font-medium tabular-nums">
            {currencyFormatter(point.value)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: "var(--color-baselineValue)" }}
          />
          <span className="text-muted-foreground">
            {m.collections_stats_value_series_baseline()}
          </span>
          <span className="ml-auto font-mono font-medium tabular-nums">
            {currencyFormatter(point.baselineValue)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2" />
          <span className="text-muted-foreground">{m.collections_stats_value_price_change()}</span>
          <span className="ml-auto font-mono font-medium tabular-nums">
            {sign}
            {currencyFormatter(magnitude)}
            {percent !== null && ` (${sign}${Math.abs(percent).toFixed(1)}%)`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2" />
          <span className="text-muted-foreground">{m.collections_stats_value_cards()}</span>
          <span className="ml-auto font-mono font-medium tabular-nums">
            {point.copyCount.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

interface CollectionValueChartProps {
  collectionId?: string;
  scope: CompletionScopePreference;
}

export function CollectionValueChart({ collectionId, scope }: CollectionValueChartProps) {
  const [range, setRange] = useState<TimeRange>("30d");
  const marketplaceOrder = useDisplayStore((s) => s.marketplaceOrder);
  const [marketplace, setMarketplace] = useState<Marketplace>(marketplaceOrder[0]);

  const { data, isLoading, error } = useCollectionValueHistory(
    marketplace,
    range,
    collectionId,
    scope,
  );

  const ranges = timeRanges();
  const chartConfig = buildChartConfig();
  const series = data?.series ?? [];
  const currencyFormatter = formatterForMarketplace(marketplace);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          value={[range]}
          onValueChange={([next]) => {
            const match = ranges.find((tr) => tr.value === next);
            if (match) {
              setRange(match.value);
            }
          }}
          aria-label={m.collections_stats_value_range_label()}
        >
          {ranges.map((tr) => (
            <ToggleGroupItem key={tr.value} value={tr.value}>
              {tr.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          value={[marketplace]}
          onValueChange={([next]) => {
            const match = marketplaceOrder.find((mp) => mp === next);
            if (match) {
              setMarketplace(match);
            }
          }}
          aria-label={m.collections_stats_value_source_label()}
          className="ml-auto"
        >
          {marketplaceOrder.map((mp) => (
            <Tooltip key={mp}>
              <TooltipTrigger
                render={<ToggleGroupItem value={mp} aria-label={marketplaceLabel(mp)} />}
              >
                <MarketplaceIcon marketplace={mp} />
              </TooltipTrigger>
              <TooltipContent>{marketplaceLabel(mp)}</TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2Icon className="text-muted-foreground size-5 animate-spin" />
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <CircleXIcon />
          <AlertTitle>{m.collections_stats_value_error()}</AlertTitle>
        </Alert>
      )}

      {!isLoading && !error && series.length === 0 && (
        <Empty>
          <EmptyDescription>{m.collections_stats_value_empty()}</EmptyDescription>
        </Empty>
      )}

      {!isLoading && !error && series.length > 0 && (
        <ChartContainer config={chartConfig} className="aspect-[2.5/1] w-full">
          <ComposedChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDay}
              tick={{ fontSize: 11 }}
              interval={Math.max(0, Math.ceil(series.length / 4) - 1)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => currencyFormatter(v)}
              tick={{ fontSize: 11 }}
              width={56}
              padding={{ top: 8 }}
              axisLine={false}
              tickLine={false}
            />
            <ChartTooltip
              content={<CollectionValueTooltipContent currencyFormatter={currencyFormatter} />}
            />
            <Area
              dataKey="value"
              type="monotone"
              stroke="var(--color-value)"
              strokeWidth={2}
              fill="url(#valueFill)"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            {/* Dashed and unfilled: a reference line, not a second total. */}
            <Line
              dataKey="baselineValue"
              type="monotone"
              stroke="var(--color-baselineValue)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <ChartLegend content={<ChartLegendContent />} />
          </ComposedChart>
        </ChartContainer>
      )}
    </div>
  );
}
