import { CrownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Hand-authored primitive (not shadcn-scaffolded).

type RankBandTone = "gold" | "silver" | "bronze" | "muted" | "plain";

type RankBandLayout = "stacked" | "inline";

const TONE_CLASS: Record<RankBandTone, string> = {
  gold: "bg-amber-500 text-amber-950",
  silver: "bg-zinc-400 text-zinc-900",
  bronze: "bg-amber-700 text-amber-50",
  muted: "bg-muted text-muted-foreground",
  plain: "text-muted-foreground",
};

const RING_CLASS: Record<RankBandTone, string> = {
  gold: "ring-amber-500",
  silver: "ring-zinc-400",
  bronze: "ring-amber-700",
  muted: "ring-border",
  plain: "ring-border",
};

const LAYOUT_CLASS: Record<RankBandLayout, string> = {
  stacked: "flex-col justify-center gap-1 px-1 py-1.5",
  inline: "justify-between gap-2 px-3 py-1.5",
};

function numeralBoxClass(layout: RankBandLayout, crowned: boolean): string {
  if (layout === "inline") {
    return crowned ? "w-18 shrink-0" : "w-14 shrink-0";
  }
  return crowned ? "w-full max-w-18 justify-center" : "w-full max-w-14 justify-center";
}

function numeralSizeClass(length: number, crowned: boolean): string {
  if (crowned) {
    return "text-2xl @max-[3.75rem]:text-lg @max-[3.25rem]:text-base";
  }
  if (length <= 2) {
    return "text-2xl";
  }
  if (length === 3) {
    return "text-2xl @max-[2.5rem]:text-lg @max-[1.875rem]:text-base";
  }
  if (length === 4) {
    return "text-2xl @max-[3.5rem]:text-lg @max-[2.75rem]:text-base";
  }
  if (length === 5) {
    return "text-lg @max-[3.25rem]:text-base";
  }
  return "text-base";
}

export function rankBandTone(rank: number, filled: boolean): RankBandTone {
  if (rank === 1) {
    return "gold";
  }
  if (rank === 2) {
    return "silver";
  }
  if (rank === 3) {
    return "bronze";
  }
  return filled ? "muted" : "plain";
}

export function rankBandRingClass(tone: RankBandTone): string {
  return RING_CLASS[tone];
}

export function RankBand({
  rank,
  text,
  label,
  filled = true,
  layout = "stacked",
  crownOnly = false,
  className,
}: {
  rank: number;
  text: string;
  label?: string | null;
  filled?: boolean;
  layout?: RankBandLayout;
  crownOnly?: boolean;
  className?: string;
}) {
  const tone = rankBandTone(rank, filled);
  const bareCrown = rank === 1 && crownOnly;
  const crowned = rank === 1 && !crownOnly;

  return (
    <div
      data-slot="rank-band"
      data-tone={tone}
      className={cn("flex items-center", LAYOUT_CLASS[layout], TONE_CLASS[tone], className)}
    >
      <div className={cn("@container flex", numeralBoxClass(layout, crowned))}>
        <span
          className={cn(
            "font-heading flex items-center gap-1.5 leading-none font-bold whitespace-nowrap tabular-nums",
            numeralSizeClass(text.length, crowned),
          )}
        >
          {rank === 1 && (
            <CrownIcon
              aria-hidden
              className={cn("fill-current", bareCrown ? "size-6" : "size-5")}
            />
          )}
          {bareCrown ? <span className="sr-only">{text}</span> : text}
        </span>
      </div>
      {label !== undefined && label !== null && (
        <span className="text-2xs font-semibold tracking-wider whitespace-nowrap uppercase">
          {label}
        </span>
      )}
    </div>
  );
}
