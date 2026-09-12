import { TIER_LABEL_INK, tierColor } from "@openrift/shared/tier-colors";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { MiniCardArt, Swap, Vignette, VignetteHeading } from "./vignette-parts";

const TILE = "w-11 shrink-0";

interface Tier {
  label: string;
  index: number;
}

// Must never render "S"/"D": row labels are user-renamed from those defaults.
function tier1(): Tier {
  return { label: m.marketing_tier_list_tier_1(), index: 0 };
}

function tier2(): Tier {
  return { label: m.marketing_tier_list_tier_2(), index: 1 };
}

function fringe(): Tier {
  return { label: m.marketing_tier_list_fringe(), index: 2 };
}

function TierRow({ tier, children }: { tier: Tier; children: ReactNode }) {
  return (
    // No overflow-hidden: the tile animating in from the pool must pass over rows below.
    <div className="ring-border bg-background/40 flex items-stretch rounded-md ring-1">
      <div
        className="text-2xs flex w-12 shrink-0 items-center justify-center rounded-s-md px-1 text-center font-bold wrap-anywhere"
        style={{ backgroundColor: tierColor(tier.index), color: TIER_LABEL_INK }}
      >
        {tier.label}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-1 p-1">{children}</div>
    </div>
  );
}

function Tile({ url, className }: { url?: string; className?: string }) {
  if (!url) {
    return <span className={cn("aspect-card bg-muted rounded-[5%/3.6%]", TILE, className)} />;
  }
  return <MiniCardArt url={url} className={cn(TILE, className)} />;
}

// h-5 and the rounding are CountPill's; the real control is a CountPillButton,
// which nothing in a miniature may be.
const PILL = "text-2xs inline-flex h-5 max-w-11 items-center truncate rounded-md px-1.5 font-bold";

function TierPill({ tier }: { tier: Tier }) {
  return (
    <span
      className={PILL}
      style={{ backgroundColor: tierColor(tier.index), color: TIER_LABEL_INK }}
    >
      {tier.label}
    </span>
  );
}

function RankPill() {
  return (
    <span className={cn(PILL, "bg-muted text-muted-foreground")}>
      {m.marketing_tier_list_rank()}
    </span>
  );
}

function PoolCell({ url, tier, animate }: { url?: string; tier?: Tier; animate?: boolean }) {
  return (
    <span className="flex flex-col items-center gap-1">
      <Tile
        url={url}
        className={cn(tier && "opacity-40", animate && "motion-safe:animate-tier-pool-dim")}
      />
      {animate && tier ? (
        <Swap className="justify-items-center" was={<RankPill />} now={<TierPill tier={tier} />} />
      ) : tier ? (
        <TierPill tier={tier} />
      ) : (
        <RankPill />
      )}
    </span>
  );
}

// Ramp colours come from the shared `tierColor`, the same function the real
// board and the API's share image use; a hand-picked copy here would drift.
export function TierListVignette({ legendUrls = [] }: { legendUrls?: string[] }) {
  const art = (index: number) => legendUrls[index];
  return (
    <Vignette>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{m.marketing_tier_list_heading()}</span>
        <VignetteHeading>
          <Swap
            was={<>{m.marketing_tier_list_ranked({ count: 8 })}</>}
            now={<>{m.marketing_tier_list_ranked({ count: 9 })}</>}
          />
        </VignetteHeading>
      </div>

      <div className="flex flex-col gap-1.5">
        <TierRow tier={tier1()}>
          <Tile url={art(0)} />
          <Tile url={art(1)} />
          <Tile url={art(2)} />
          <Tile url={art(3)} />
          {/* z-10: the flight crosses the rows below, which come later in the
              DOM and would otherwise paint over it. */}
          <Tile url={art(4)} className="motion-safe:animate-tier-land relative z-10" />
        </TierRow>
        <TierRow tier={tier2()}>
          <Tile url={art(5)} />
          <Tile url={art(6)} />
          <Tile url={art(7)} />
        </TierRow>
        <TierRow tier={fringe()}>
          <Tile url={art(8)} />
        </TierRow>
      </div>

      <div className="flex flex-col gap-1.5">
        <VignetteHeading>{m.marketing_tier_list_card_pool()}</VignetteHeading>
        <div className="flex items-start gap-1.5">
          <PoolCell url={art(0)} tier={tier1()} />
          <PoolCell url={art(5)} tier={tier2()} />
          <PoolCell url={art(4)} tier={tier1()} animate />
          <PoolCell url={art(8)} tier={fringe()} />
          <PoolCell url={art(9)} />
        </div>
      </div>
    </Vignette>
  );
}
