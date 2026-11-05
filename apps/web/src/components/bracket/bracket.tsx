import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { accentGlow } from "@/components/ui/podium";
import { RankBand } from "@/components/ui/rank-band";
import { cn } from "@/lib/utils";

const FINAL_GLOW = accentGlow(12);

const MARK_SLOT = "flex h-11 w-16 shrink-0 items-center justify-center";

export function BracketColumns({
  columnCount,
  children,
  className,
}: {
  columnCount: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    // flex-col-reverse renders the rounds final-first on phones without duplicate markup.
    <div
      data-slot="bracket-columns"
      className={cn("flex flex-col-reverse gap-4 lg:grid lg:gap-5", className)}
      style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}

export function BracketColumn({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div data-slot="bracket-column" className="flex flex-col justify-center gap-2.5">
      <span className="text-muted-foreground text-xs font-semibold">{label}</span>
      {children}
    </div>
  );
}

export function BracketMatchCard({
  isFinal = false,
  label,
  aside,
  children,
}: {
  isFinal?: boolean;
  label?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card
      className={cn("gap-0 py-0", isFinal && "ring-border-accent/50")}
      style={isFinal ? { backgroundImage: FINAL_GLOW } : undefined}
    >
      {label === undefined && aside === undefined ? null : (
        <div className="text-muted-foreground flex items-center justify-between border-b px-3 py-1.5 text-xs font-semibold">
          <span>{label}</span>
          <span className="font-normal">{aside}</span>
        </div>
      )}
      {children}
    </Card>
  );
}

/** Without `mark` the row keeps an empty mark column so names still line up. */
export function BracketSeatRow({
  winner,
  mark,
  name,
  score,
  children,
}: {
  winner: boolean;
  mark?: ReactNode;
  name: ReactNode;
  score: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      data-slot="bracket-seat"
      data-winner={winner || undefined}
      className={cn(
        "flex text-sm not-last:border-b",
        winner ? "font-semibold" : "text-muted-foreground",
      )}
    >
      {mark ?? <span className={MARK_SLOT} />}
      <div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {children}
        <span className="w-6 text-right tabular-nums">{score}</span>
      </div>
    </div>
  );
}

export function BracketRankMark({ rank, text }: { rank: number; text: string }) {
  return (
    <span className={MARK_SLOT}>
      <RankBand rank={rank} text={text} crownOnly className="w-14" />
    </span>
  );
}

export function BracketSeedMark({ children }: { children: ReactNode }) {
  return <span className={MARK_SLOT}>{children}</span>;
}

export function BracketEmptySeat({ children }: { children: ReactNode }) {
  return (
    <div data-slot="bracket-seat" className="text-muted-foreground flex text-sm not-last:border-b">
      <span className={MARK_SLOT} />
      <span className="flex min-w-0 flex-1 items-center px-3 py-2.5">{children}</span>
    </div>
  );
}
