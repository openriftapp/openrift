import { MARKETPLACE_LINKS } from "@openrift/shared/marketplace";
import { ALL_MARKETPLACES } from "@openrift/shared/types/pricing";
import { ArrowUpRightIcon } from "lucide-react";
import type { CSSProperties } from "react";

import { MarketplaceIcon } from "@/components/marketplace-icon";
import { buttonVariants } from "@/components/ui/button";
import { toggleVariants } from "@/components/ui/toggle";
import { TIME_RANGES, timeRangeLabel } from "@/features/cards/lib/price-history-chart-constants";
import { formatTickDate } from "@/features/cards/lib/price-history-ticks";
import { FIXTURE_PRICE_CARD, FIXTURE_PRICES } from "@/features/marketing/lib/vignette-fixtures";
import {
  PRICE_SAMPLE_COUNT,
  chartDay,
  priceSeries,
  tickStep,
} from "@/features/marketing/lib/vignette-price-chart";
import { formatterForMarketplace, priceColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { Vignette } from "./vignette-parts";

const SELECTED = ALL_MARKETPLACES[0];
const SELECTED_RANGE = "30d";
const RANGE_DAYS = 30;

const PLOT = { left: 44, right: 296, top: 20, bottom: 92, step: 26 };

function PriceRows() {
  return (
    <ul className="divide-border overflow-hidden rounded-lg border">
      {ALL_MARKETPLACES.map((marketplace) => {
        const isSelected = marketplace === SELECTED;
        const price = FIXTURE_PRICES[marketplace].price;
        return (
          <li
            key={marketplace}
            className={cn(
              "flex h-10 items-center gap-2 border-t pr-1.5 first:border-t-0",
              isSelected && "bg-muted",
            )}
          >
            <span className="flex h-full min-w-0 flex-1 items-center gap-2.5 pl-3">
              <span className="flex w-5 shrink-0 items-center justify-center">
                <MarketplaceIcon marketplace={marketplace} alt="" />
              </span>
              <span className={cn("flex-1 truncate", !isSelected && "text-muted-foreground")}>
                {MARKETPLACE_LINKS[marketplace].label}
              </span>
              <span className={cn("font-semibold tabular-nums", priceColorClass(price))}>
                {formatterForMarketplace(marketplace)(price)}
              </span>
            </span>
            <span aria-hidden="true" className={cn(buttonVariants({ size: "xs" }), "shrink-0")}>
              {m.card_detail_buy()}
              <ArrowUpRightIcon />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function RangeStrip() {
  return (
    <span aria-hidden="true" className="bg-background absolute top-2 right-2 z-10 flex">
      {TIME_RANGES.map((range) => (
        <span
          key={range.value}
          className={cn(
            toggleVariants({ variant: "outline", size: "sm" }),
            "rounded-none first:rounded-l-md last:rounded-r-md",
            range.value === SELECTED_RANGE && "bg-muted text-foreground",
          )}
        >
          {timeRangeLabel(range)}
        </span>
      ))}
    </span>
  );
}

function PriceChart() {
  const format = formatterForMarketplace(SELECTED);
  const values = priceSeries(FIXTURE_PRICES[SELECTED], RANGE_DAYS);
  const step = tickStep(Math.min(...values), Math.max(...values));
  const topTick = Math.ceil(Math.max(...values) / step) * step;

  const points: [number, number][] = values.map((value, index) => [
    PLOT.left + (index / (PRICE_SAMPLE_COUNT - 1)) * (PLOT.right - PLOT.left),
    PLOT.top + ((topTick - value) / step) * PLOT.step,
  ]);
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const area = `${line} L${PLOT.right},${PLOT.bottom} L${PLOT.left},${PLOT.bottom} Z`;
  let length = 0;
  let previous: [number, number] | undefined;
  for (const [x, y] of points) {
    if (previous) {
      length += Math.hypot(x - previous[0], y - previous[1]);
    }
    previous = [x, y];
  }

  return (
    <div className="bg-muted/40 relative rounded-lg p-2 pt-12">
      <RangeStrip />
      <svg
        viewBox="0 0 300 110"
        className="w-full"
        role="img"
        aria-label={m.card_detail_price_history_title()}
      >
        <defs>
          <linearGradient id="vignette-price-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <g stroke="var(--border)" strokeDasharray="3 3" strokeWidth="1">
          {[20, 46, 72, 92].map((y) => (
            <line key={y} x1="40" x2="300" y1={y} y2={y} />
          ))}
          {[113, 182, 251].map((x) => (
            <line key={x} x1={x} x2={x} y1="8" y2="92" />
          ))}
        </g>
        <path
          d={area}
          fill="url(#vignette-price-fill)"
          className="motion-safe:animate-vignette-now"
        />
        <path
          d={line}
          fill="none"
          stroke="var(--chart-1)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeDasharray={length}
          className="motion-safe:animate-vignette-draw"
          style={{ "--vignette-draw-length": String(length) } as CSSProperties}
        />
        <g className="fill-muted-foreground" fontSize={7}>
          {[0, 1, 2].map((index) => (
            <text key={index} x="0" y={23 + index * PLOT.step}>
              {format(topTick - index * step)}
            </text>
          ))}
          {[RANGE_DAYS, Math.round(RANGE_DAYS / 2), 0].map((daysAgo, index) => (
            <text key={daysAgo} x={40 + index * 104} y="106">
              {formatTickDate(chartDay(daysAgo))}
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
}

export function PricesVignette() {
  return (
    <Vignette>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{FIXTURE_PRICE_CARD.name}</span>
        <span className="text-muted-foreground text-xs">{FIXTURE_PRICE_CARD.shortCode}</span>
      </div>
      <PriceRows />
      <PriceChart />
    </Vignette>
  );
}
