import type { AdminGrowthDay } from "@openrift/shared/contracts/admin/dashboard";
import { useId, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { GrowthPoint, GrowthRange } from "@/features/admin/lib/growth";
import {
  GROWTH_RANGES,
  GROWTH_RANGE_LABELS,
  countAdded,
  toGrowthSeries,
} from "@/features/admin/lib/growth";

const chartConfig = {
  total: { label: "Total", color: "var(--chart-1)" },
} satisfies ChartConfig;

function GrowthTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: GrowthPoint }[];
  label: string;
}) {
  const [firstEntry] = payload ?? [];
  if (!active || firstEntry === undefined) {
    return null;
  }
  const point = firstEntry.payload;
  return (
    <div className="border-border/50 bg-background rounded-lg border px-2.5 py-1.5 text-xs shadow-md">
      <p className="mb-1 font-medium">{point.date}</p>
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ backgroundColor: "var(--color-total)" }} />
          <span className="text-muted-foreground">{label}</span>
          <span className="ml-auto font-mono font-medium tabular-nums">
            {point.total.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2" />
          <span className="text-muted-foreground">New</span>
          <span className="ml-auto font-mono font-medium tabular-nums">
            +{point.added.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

export function GrowthRangeToggle({
  value,
  onChange,
  className,
}: {
  value: GrowthRange;
  onChange: (range: GrowthRange) => void;
  className?: string;
}) {
  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={0}
      value={[value]}
      onValueChange={([next]) => {
        const match = GROWTH_RANGES.find((r) => r === next);
        if (match) {
          onChange(match);
        }
      }}
      aria-label="Time range"
      className={className}
    >
      {GROWTH_RANGES.map((range) => (
        <ToggleGroupItem key={range} value={range}>
          {GROWTH_RANGE_LABELS[range]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function GrowthChart({
  series,
  label,
  compact = false,
}: {
  series: GrowthPoint[];
  label: string;
  compact?: boolean;
}) {
  const fillId = `growth-fill-${useId().replaceAll(":", "")}`;

  if (series.length === 0) {
    return compact ? (
      <div className="text-muted-foreground flex aspect-[3/1] items-center text-xs">
        Nothing yet
      </div>
    ) : (
      <Empty>
        <EmptyHeader>
          <EmptyDescription>Nothing yet.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-[3/1] w-full">
      <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-total)" stopOpacity={0.2} />
            <stop offset="100%" stopColor="var(--color-total)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {!compact && <CartesianGrid strokeDasharray="3 3" />}
        <XAxis
          dataKey="date"
          hide={compact}
          tick={{ fontSize: 11 }}
          interval={Math.max(0, Math.ceil(series.length / 4) - 1)}
          axisLine={false}
          tickLine={false}
        />
        {/* Not zero-based: a running total dwarfs a month of growth, and the ticks carry the real count. */}
        <YAxis
          hide={compact}
          tickFormatter={(v: number) => v.toLocaleString()}
          tick={{ fontSize: 11 }}
          width={48}
          domain={["dataMin", "dataMax"]}
          padding={{ top: 8 }}
          axisLine={false}
          tickLine={false}
        />
        <ChartTooltip content={<GrowthTooltipContent label={label} />} />
        <Area
          dataKey="total"
          type="monotone"
          stroke="var(--color-total)"
          strokeWidth={2}
          fill={`url(#${fillId})`}
          baseValue="dataMin"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function GrowthPanel({
  days,
  label,
  noun,
}: {
  days: AdminGrowthDay[];
  label: string;
  noun: [singular: string, plural: string];
}) {
  const [range, setRange] = useState<GrowthRange>("30d");

  const series = toGrowthSeries(days, range);
  const added = countAdded(series);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-muted-foreground text-sm">
          {added === 0
            ? `No new ${noun[1]} in this range`
            : `+${added.toLocaleString()} ${added === 1 ? noun[0] : noun[1]} in this range`}
        </p>
        <GrowthRangeToggle value={range} onChange={setRange} className="ml-auto" />
      </div>
      <GrowthChart series={series} label={label} />
    </div>
  );
}
