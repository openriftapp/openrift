import type { ReactNode } from "react";
import { useState } from "react";

import { Card } from "@/components/ui/card";
import { ExpandToggle } from "@/components/ui/expand-toggle";
import { RankBand } from "@/components/ui/rank-band";
import { FINAL_GLOW } from "@/lib/accent-wash";
import { cn } from "@/lib/utils";

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
    <div
      data-slot="bracket-columns"
      className={cn(
        "flex flex-col gap-4 lg:-m-px lg:grid lg:gap-5 lg:overflow-x-auto lg:p-px lg:pb-2",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(18rem, 1fr))` }}
    >
      {children}
    </div>
  );
}

/**
 * A `collapsed` round folds to its label below `lg`; the reader's toggle lasts
 * until the round stops being collapsed. Wide layouts show every round.
 */
export function BracketColumn({
  label,
  collapsed,
  children,
}: {
  label: ReactNode;
  collapsed?: true;
  children: ReactNode;
}) {
  const [override, setOverride] = useState<boolean | null>(null);
  if (!collapsed && override !== null) {
    setOverride(null);
  }
  const open = !collapsed || (override ?? false);
  return (
    <div data-slot="bracket-column" className="flex flex-col justify-center gap-2.5">
      {collapsed === undefined ? (
        <span className="text-muted-foreground text-xs font-semibold">{label}</span>
      ) : (
        <>
          <span className="text-muted-foreground hidden text-xs font-semibold lg:inline">
            {label}
          </span>
          <ExpandToggle
            expanded={open}
            chevronPosition="end"
            onClick={() => setOverride(!open)}
            className="bg-card min-h-11 w-full justify-between rounded-xl border px-3 text-sm lg:hidden"
          >
            <span className="font-semibold">{label}</span>
          </ExpandToggle>
        </>
      )}
      <div
        data-slot="bracket-column-matches"
        className={cn("flex-col gap-2.5 lg:flex", open ? "flex" : "hidden")}
      >
        {children}
      </div>
    </div>
  );
}

export function BracketMatchCard({
  isFinal = false,
  pending = false,
  label,
  aside,
  footer,
  children,
}: {
  isFinal?: boolean;
  pending?: boolean;
  label?: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card
      className={cn(
        "gap-0 py-0",
        isFinal && "ring-border-accent/50",
        pending && "bg-transparent opacity-60",
        pending && !isFinal && "border border-dashed ring-0",
      )}
      style={isFinal ? { backgroundImage: FINAL_GLOW } : undefined}
    >
      {label === undefined && aside === undefined ? null : (
        <div className="text-muted-foreground flex items-center justify-between border-b px-3 py-1.5 text-xs font-semibold">
          <span>{label}</span>
          <span className="flex items-center gap-2 font-normal">{aside}</span>
        </div>
      )}
      {children}
      {footer ? <div className="flex justify-end border-t px-3 py-2">{footer}</div> : null}
    </Card>
  );
}

/**
 * Without `mark` the row keeps an empty mark column so names still line up.
 * Without `outcome` the match is undecided and neither seat is styled.
 */
export function BracketSeatRow({
  outcome,
  mark,
  name,
  score,
  children,
}: {
  outcome?: "won" | "lost";
  mark?: ReactNode;
  name: ReactNode;
  score: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      data-slot="bracket-seat"
      data-outcome={outcome}
      className={cn(
        "flex text-sm not-last:border-b",
        outcome === "won" && "bg-primary/10 font-semibold",
        outcome === "lost" && "text-muted-foreground",
      )}
    >
      {mark ?? <span className={MARK_SLOT} />}
      <div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {children}
        <span className={cn("w-6 text-right tabular-nums", outcome === "won" && "text-primary")}>
          {score}
        </span>
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
