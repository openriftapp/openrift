import { CrownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Hand-authored primitive (not shadcn-scaffolded).

type RankBandTone = "gold" | "silver" | "bronze" | "muted" | "plain";

type RankBandLayout = "chip" | "band";

const CHIP_TONE_CLASS: Record<RankBandTone, string> = {
  gold: "border-amber-500/60 bg-amber-500/16 text-amber-700 dark:text-amber-300",
  silver: "border-zinc-400/60 bg-zinc-400/16 text-zinc-700 dark:text-zinc-200",
  bronze: "border-amber-700/60 bg-amber-700/16 text-amber-800 dark:text-orange-300",
  muted: "border-border bg-muted text-muted-foreground",
  plain: "border-border text-muted-foreground",
};

const BAND_TONE_CLASS: Record<RankBandTone, string> = {
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

function numeralSizeClass(length: number, crowned: boolean): string {
  if (crowned) {
    return "text-lg";
  }
  if (length <= 3) {
    return "text-2xl";
  }
  if (length === 4) {
    return "text-lg";
  }
  if (length === 5) {
    return "text-base";
  }
  return "text-sm";
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
  layout = "chip",
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
  const chip = layout === "chip";

  return (
    <div
      data-slot="rank-band"
      data-tone={tone}
      data-layout={layout}
      className={cn(
        "flex items-center",
        chip
          ? cn("flex-col justify-center gap-1 rounded-md border px-1.5 py-1", CHIP_TONE_CLASS[tone])
          : cn("justify-between gap-2 px-3 py-1.5", BAND_TONE_CLASS[tone]),
        className,
      )}
    >
      <span
        className={cn(
          "font-heading flex items-center gap-1 leading-none font-bold whitespace-nowrap tabular-nums",
          chip ? cn("h-6", numeralSizeClass(text.length, crowned)) : "text-2xl",
        )}
      >
        {rank === 1 && (
          <CrownIcon
            aria-hidden
            className={cn("fill-current", bareCrown ? "size-5" : chip ? "size-4" : "size-5")}
          />
        )}
        {bareCrown ? <span className="sr-only">{text}</span> : text}
      </span>
      {label !== undefined && label !== null && (
        <span className="text-2xs font-semibold tracking-wider whitespace-nowrap uppercase">
          {label}
        </span>
      )}
    </div>
  );
}
