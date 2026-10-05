import { formatDay } from "@openrift/shared/format-date";
import { marketplaceLabel } from "@openrift/shared/marketplace";
import type { AnySnapshot } from "@openrift/shared/types/api/pricing";
import type { Marketplace, TimeRange } from "@openrift/shared/types/pricing";
import { CircleXIcon } from "lucide-react";
import { useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts";

import { MarketplaceIcon } from "@/components/marketplace-icon";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PriceTrend } from "@/features/cards/components/price-trend";
import { usePriceHistory } from "@/features/cards/hooks/use-price-history";
import { TIME_RANGES, timeRangeLabel } from "@/features/cards/lib/price-history-chart-constants";
import { priceHistoryPoint } from "@/features/cards/lib/price-history-points";
import { formatterForMarketplace } from "@/lib/format";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

function headlineLabel(source: Marketplace): string {
  if (source === "cardtrader") {
    return m.card_detail_chart_zero();
  }
  return source === "cardnexus" ? m.card_detail_chart_low() : m.card_detail_chart_market();
}

function buildChartConfig(source: Marketplace) {
  return {
    value: { label: headlineLabel(source), color: "var(--chart-1)" },
    low: { label: m.card_detail_chart_low(), color: "var(--chart-2)" },
  } satisfies ChartConfig;
}

interface PriceHistoryChartProps {
  printingId: string;
  range?: TimeRange;
  onRangeChange?: (range: TimeRange) => void;
  highlightedDate?: string | null;
  onDateHover?: (date: string | null) => void;
  source?: Marketplace;
  onSourceChange?: (source: Marketplace) => void;
  hideControls?: boolean;
}

export function PriceHistoryChart({
  printingId,
  range: controlledRange,
  onRangeChange,
  highlightedDate,
  onDateHover,
  source: controlledSource,
  onSourceChange,
  hideControls,
}: PriceHistoryChartProps) {
  const [internalRange, setInternalRange] = useState<TimeRange>("30d");
  const range = controlledRange ?? internalRange;
  const setRange = onRangeChange ?? setInternalRange;
  const marketplaceOrder = useDisplayStore((s) => s.marketplaceOrder);
  const [internalSource, setInternalSource] = useState<Marketplace>(marketplaceOrder[0]);
  const source = controlledSource ?? internalSource;
  const setSource = onSourceChange ?? setInternalSource;

  const { data: allData } = usePriceHistory(printingId, "all");

  const allSnapshots = allData?.[source]?.snapshots;
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

  const { data, isLoading, error } = usePriceHistory(printingId, effectiveRange);

  const currencyFormatter = formatterForMarketplace(source);
  const sourceData = data?.[source];
  const rawSnapshots: AnySnapshot[] = sourceData?.snapshots ?? [];
  const snapshots = rawSnapshots.map((s) => priceHistoryPoint(s));

  const hasLow = snapshots.some((s) => s.low !== null);
  const plottedValues = snapshots.reduce<number[]>((values, s) => {
    if (s.value !== null) {
      values.push(s.value);
    }
    return values;
  }, []);

  const btnSize = "sm" as const;
  const chartConfig = buildChartConfig(source);

  return (
    <div className="space-y-3">
      {!hideControls && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <ToggleGroup
            variant="outline"
            size={btnSize}
            spacing={0}
            value={[effectiveRange]}
            onValueChange={([next]) => {
              const match = availableRanges.find((tr) => tr.value === next);
              if (match) {
                setRange(match.value);
              }
            }}
            aria-label={m.card_detail_time_range()}
          >
            {availableRanges.map((tr) => (
              <ToggleGroupItem key={tr.value} value={tr.value}>
                {timeRangeLabel(tr)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
            {marketplaceLabel(source)}
            <PriceTrend values={plottedValues} range={effectiveRange} />
          </span>
          <ToggleGroup
            variant="outline"
            size={btnSize}
            spacing={0}
            value={[source]}
            onValueChange={([next]) => {
              const match = marketplaceOrder.find((s) => s === next);
              if (match) {
                setSource(match);
              }
            }}
            aria-label={m.card_detail_price_source()}
            className="ml-auto"
          >
            {marketplaceOrder.map((s) => {
              const available = data?.[s]?.available ?? false;
              const label = marketplaceLabel(s);
              return (
                <Tooltip key={s}>
                  <TooltipTrigger
                    render={
                      <ToggleGroupItem
                        value={s}
                        disabled={!available && Boolean(data)}
                        aria-label={label}
                      />
                    }
                  >
                    <MarketplaceIcon marketplace={s} />
                  </TooltipTrigger>
                  <TooltipContent>{label}</TooltipContent>
                </Tooltip>
              );
            })}
          </ToggleGroup>
        </div>
      )}

      {/* Full chart-height placeholder avoids a layout jump when the history loads. */}
      {isLoading && (
        <div className="flex aspect-[2.5/1] w-full items-center justify-center">
          <Spinner className="text-muted-foreground size-5" />
        </div>
      )}

      {error && (
        <p className="text-muted-foreground flex items-center justify-center gap-1.5 py-8 text-sm">
          <CircleXIcon className="text-destructive size-4 shrink-0" />
          {m.card_detail_chart_error()}
        </p>
      )}

      {!isLoading && !error && snapshots.length === 0 && (
        <Empty className="py-8">
          <EmptyDescription>{m.card_detail_chart_empty()}</EmptyDescription>
        </Empty>
      )}

      {!isLoading && !error && snapshots.length > 0 && (
        <ChartContainer config={chartConfig} className="aspect-[2.5/1] w-full">
          <ComposedChart
            data={snapshots}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            onMouseMove={(state: Record<string, unknown>) => {
              const activePayload = state?.activePayload as
                | { payload?: Record<string, unknown> }[]
                | undefined;
              const date = activePayload?.[0]?.payload?.date as string | undefined;
              if (onDateHover && date) {
                onDateHover(date);
              }
            }}
            onMouseLeave={() => onDateHover?.(null)}
          >
            <defs>
              <linearGradient id="marketFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            {highlightedDate && (
              <ReferenceLine
                x={highlightedDate}
                stroke="var(--color-value)"
                strokeWidth={2}
                strokeOpacity={0.6}
              />
            )}
            <XAxis
              dataKey="date"
              tickFormatter={formatDay}
              tick={{ fontSize: 11 }}
              interval={Math.max(0, Math.ceil(snapshots.length / 4) - 1)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => currencyFormatter(v)}
              tick={{ fontSize: 11 }}
              width={48}
              padding={{ top: 8 }}
              axisLine={false}
              tickLine={false}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const point: unknown = payload[0]?.payload;
                    const date =
                      typeof point === "object" && point !== null && "date" in point
                        ? point.date
                        : undefined;
                    return typeof date === "string" ? formatDay(date) : null;
                  }}
                  formatter={(value, name) =>
                    typeof value === "number" ? (
                      <>
                        <span
                          className="size-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: `var(--color-${name})` }}
                        />
                        <span className="text-muted-foreground">
                          {chartConfig[name === "low" ? "low" : "value"].label}
                        </span>
                        <span className="text-foreground ml-auto font-mono font-medium tabular-nums">
                          {currencyFormatter(value)}
                        </span>
                      </>
                    ) : null
                  }
                />
              }
            />
            <Area
              dataKey="value"
              type="monotone"
              stroke="var(--color-value)"
              strokeWidth={2}
              fill="url(#marketFill)"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            {hasLow && (
              <Line
                dataKey="low"
                type="monotone"
                stroke="var(--color-low)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ChartContainer>
      )}
    </div>
  );
}
