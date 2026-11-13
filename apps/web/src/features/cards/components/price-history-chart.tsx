import { formatShortDayYear } from "@openrift/shared/format-date";
import type { AnySnapshot } from "@openrift/shared/types/api/pricing";
import type { Marketplace, TimeRange } from "@openrift/shared/types/pricing";
import { CircleXIcon } from "lucide-react";
import { useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { usePriceHistory } from "@/features/cards/hooks/use-price-history";
import {
  availableTimeRanges,
  effectiveTimeRange,
  snapshotSpanDays,
  timeRangeLabel,
} from "@/features/cards/lib/price-history-chart-constants";
import { priceHistoryPoint } from "@/features/cards/lib/price-history-points";
import {
  formatTickDate,
  lastValueLabelPosition,
  lastValuePoint,
  spansYears,
  tickAnchor,
} from "@/features/cards/lib/price-history-ticks";
import { DATE_WORDS } from "@/lib/date-words";
import { formatterForMarketplace } from "@/lib/format";
import { m } from "@/paraglide/messages.js";

function headlineLabel(source: Marketplace): string {
  if (source === "cardtrader") {
    return m.card_detail_chart_zero();
  }
  return source === "tcgplayer" ? m.card_detail_chart_market() : m.card_detail_chart_low();
}

function buildChartConfig(source: Marketplace) {
  return {
    value: { label: headlineLabel(source), color: "var(--chart-1)" },
    secondary: {
      label: source === "cardmarket" ? m.card_detail_chart_market() : m.card_detail_chart_low(),
      color: "var(--chart-2)",
    },
  } satisfies ChartConfig;
}

interface PriceHistoryChartProps {
  printingId: string;
  range?: TimeRange;
  onRangeChange?: (range: TimeRange) => void;
  highlightedDate?: string | null;
  onDateHover?: (date: string | null) => void;
  source: Marketplace;
  ranges?: readonly TimeRange[];
}

export function PriceHistoryChart({
  printingId,
  range: controlledRange,
  onRangeChange,
  highlightedDate,
  onDateHover,
  source,
  ranges,
}: PriceHistoryChartProps) {
  const [internalRange, setInternalRange] = useState<TimeRange>("30d");
  const range = controlledRange ?? internalRange;
  const setRange = onRangeChange ?? setInternalRange;

  const { data: allData } = usePriceHistory(printingId, "all");

  const availableRanges = availableTimeRanges(
    snapshotSpanDays(allData?.[source]?.snapshots),
    ranges,
  );
  const effectiveRange = effectiveTimeRange(range, availableRanges);

  const { data, isLoading, error } = usePriceHistory(printingId, effectiveRange);

  const currencyFormatter = formatterForMarketplace(source);
  const sourceData = data?.[source];
  const rawSnapshots: AnySnapshot[] = sourceData?.snapshots ?? [];
  const snapshots = rawSnapshots.map((s) => priceHistoryPoint(source, s));

  const lastPoint = lastValuePoint(snapshots);
  const tickWithYear = spansYears(snapshots);
  const hasSecondary = snapshots.some((s) => s.secondary !== null);
  const chartConfig = buildChartConfig(source);

  return (
    <div className="bg-muted/40 relative rounded-lg p-2">
      <ToggleGroup
        variant="outline"
        size="sm"
        spacing={0}
        value={[effectiveRange]}
        onValueChange={([next]) => {
          const match = availableRanges.find((tr) => tr.value === next);
          if (match) {
            setRange(match.value);
          }
        }}
        aria-label={m.card_detail_time_range()}
        className="bg-background absolute top-2 right-2 z-10"
      >
        {availableRanges.map((tr) => (
          <ToggleGroupItem key={tr.value} value={tr.value}>
            {timeRangeLabel(tr)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

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
            margin={{ top: 40, right: 12, bottom: 0, left: 0 }}
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
              tick={(props: {
                x: number | string;
                y: number | string;
                index: number;
                visibleTicksCount: number;
                payload: { value: string };
              }) => (
                <text
                  x={props.x}
                  y={props.y}
                  dy={12}
                  fontSize={11}
                  className="fill-muted-foreground"
                  textAnchor={tickAnchor(props.index, props.visibleTicksCount)}
                >
                  {formatTickDate(props.payload.value, tickWithYear)}
                </text>
              )}
              tickFormatter={(value: string) => formatTickDate(value, tickWithYear)}
              interval="preserveStartEnd"
              minTickGap={24}
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
                    return typeof date === "string" ? formatShortDayYear(date, DATE_WORDS) : null;
                  }}
                  formatter={(value, name) =>
                    typeof value === "number" ? (
                      <>
                        <span
                          className="size-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: `var(--color-${name})` }}
                        />
                        <span className="text-muted-foreground">
                          {chartConfig[name === "secondary" ? "secondary" : "value"].label}
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
            {lastPoint !== undefined && lastPoint.value !== null && (
              <ReferenceDot
                x={lastPoint.date}
                y={lastPoint.value}
                r={3}
                fill="var(--color-value)"
                stroke="var(--background)"
                strokeWidth={1.5}
                label={{
                  value: currencyFormatter(lastPoint.value),
                  position: lastValueLabelPosition(snapshots, lastPoint.value),
                  offset: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  fill: "var(--color-value)",
                  textAnchor: "end",
                }}
              />
            )}
            {hasSecondary && (
              <Line
                dataKey="secondary"
                type="monotone"
                stroke="var(--color-secondary)"
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
