import { enumLabel } from "@openrift/shared/enum-label";
import { ArrowRightIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { RailNodeDate } from "@/features/decks/components/deck-variant-rail-date";
import {
  ADD_CHIP,
  CHANGE_CHIP,
  CHIP_BASE,
  CUT_CHIP,
  DOT_SIZE,
  LABEL_MARGIN_X,
  LANE_BOTTOM_PAD,
  LANE_GAP,
  LANE_TOP_Y,
  PHONE_SLOT_WIDTH as SLOT_WIDTH,
} from "@/features/decks/lib/deck-variant-rail-geometry";
import type { FixtureVariantDiff } from "@/features/marketing/lib/vignette-fixtures";
import { FIXTURE_LABELS, FIXTURE_VARIANT_RAIL } from "@/features/marketing/lib/vignette-fixtures";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { ClipFrame } from "./clip-frame";

const LABEL_WIDTH = SLOT_WIDTH - LABEL_MARGIN_X;
const PAD_X = LABEL_WIDTH / 2;
const RAIL_WIDTH = PAD_X + SLOT_WIDTH * 2 + PAD_X;
const RAIL_HEIGHT = LANE_TOP_Y + LANE_GAP + LANE_BOTTOM_PAD;

function railShare(px: number): number {
  return (px / RAIL_WIDTH) * 100;
}

const SLIDE_STYLE = {
  "--variant-slide-x": `${railShare(SLOT_WIDTH)}cqw`,
  "--variant-slide-y": `${LANE_GAP}px`,
} as CSSProperties;

const ROOT_X = PAD_X;
const HEAD_X = PAD_X + SLOT_WIDTH;
const FORK_X = PAD_X + SLOT_WIDTH * 2;
const LANE_0_Y = LANE_TOP_Y;
const LANE_1_Y = LANE_TOP_Y + LANE_GAP;

const CHIP_STYLES: Record<FixtureVariantDiff["kind"], string> = {
  add: ADD_CHIP,
  cut: CUT_CHIP,
  change: CHANGE_CHIP,
};

const RAIL = FIXTURE_VARIANT_RAIL;

function NodeLabel({
  label,
  draft,
  emphasis,
}: {
  label: string;
  draft?: boolean;
  emphasis?: "a" | "b";
}) {
  const name = <span className="truncate">{label}</span>;
  return (
    <span
      className="text-2xs absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 items-center justify-center gap-1.5"
      style={{ width: `${railShare(LABEL_WIDTH)}cqw` }}
    >
      {emphasis === undefined ? (
        <span className="text-muted-foreground flex min-w-0 items-center gap-1.5">{name}</span>
      ) : (
        <span className="grid min-w-0">
          <span
            className={cn(
              "text-muted-foreground col-start-1 row-start-1 flex min-w-0 items-center gap-1.5",
              emphasis === "a"
                ? "motion-safe:animate-variant-b"
                : "motion-safe:animate-variant-a opacity-0",
            )}
          >
            {name}
          </span>
          <span
            className={cn(
              "text-foreground col-start-1 row-start-1 flex min-w-0 items-center gap-1.5 font-medium",
              emphasis === "a"
                ? "motion-safe:animate-variant-a"
                : "motion-safe:animate-variant-b opacity-0",
            )}
          >
            {name}
          </span>
        </span>
      )}
      {draft && <span className="text-warning shrink-0">{m.decks_dialog_draft_badge()}</span>}
    </span>
  );
}

function RailNode({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <span
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${railShare(x)}%`, top: y }}
    >
      {children}
    </span>
  );
}

function EdgeCounts({
  x,
  y,
  added,
  cut,
  pulse,
}: {
  x: number;
  y: number;
  added: number;
  cut: number;
  pulse?: boolean;
}) {
  return (
    <span
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${railShare(x)}%`, top: y }}
    >
      <span
        className={cn(
          "bg-background flex flex-col items-stretch gap-0.5 rounded-md text-center",
          pulse && "motion-safe:animate-variant-chip",
        )}
      >
        <span className={cn(CHIP_BASE, ADD_CHIP)}>+{added}</span>
        <span className={cn(CHIP_BASE, CUT_CHIP)}>−{cut}</span>
      </span>
    </span>
  );
}

function StepDiff({
  from,
  to,
  entries,
  emphasis,
}: {
  from: string;
  to: string;
  entries: FixtureVariantDiff[];
  emphasis: "a" | "b";
}) {
  return (
    <div
      className={cn(
        "col-start-1 row-start-1 flex min-w-0 flex-col gap-2",
        emphasis === "a"
          ? "motion-safe:animate-variant-a"
          : "motion-safe:animate-variant-b opacity-0",
      )}
    >
      <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
        <span className="truncate">{from}</span>
        <ArrowRightIcon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{to}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-muted-foreground text-2xs font-semibold tracking-wide uppercase">
          {enumLabel(FIXTURE_LABELS.zones, "main")}
        </span>
        {entries.map((entry) => (
          <div key={entry.name} className="flex items-baseline gap-2">
            <span className={cn(CHIP_BASE, CHIP_STYLES[entry.kind])}>{entry.chip}</span>
            <span className="min-w-0 flex-1 truncate">{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VariantsVignette() {
  return (
    <ClipFrame className="flex flex-col gap-4 p-5">
      <div className="min-w-0 overflow-hidden px-1">
        <div
          className="@container relative w-full"
          style={{ maxWidth: RAIL_WIDTH, height: RAIL_HEIGHT }}
        >
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 size-full"
            viewBox={`0 0 ${RAIL_WIDTH} ${RAIL_HEIGHT}`}
            preserveAspectRatio="none"
            fill="none"
          >
            <path
              d={`M ${ROOT_X} ${LANE_0_Y} L ${HEAD_X} ${LANE_0_Y}`}
              className="stroke-border"
              strokeWidth={2}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={`M ${HEAD_X} ${LANE_0_Y} C ${HEAD_X + SLOT_WIDTH / 2} ${LANE_0_Y} ${FORK_X - SLOT_WIDTH / 2} ${LANE_1_Y} ${FORK_X} ${LANE_1_Y}`}
              className="stroke-border"
              strokeWidth={2}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <EdgeCounts x={(ROOT_X + HEAD_X) / 2} y={LANE_0_Y} added={2} cut={1} />
          <EdgeCounts
            x={(HEAD_X + FORK_X) / 2}
            y={(LANE_0_Y + LANE_1_Y) / 2}
            added={4}
            cut={4}
            pulse
          />

          <RailNode x={ROOT_X} y={LANE_0_Y}>
            <NodeLabel label={RAIL.root.label} />
            <span className="bg-muted-foreground block size-2 rounded-full" />
            <RailNodeDate updatedAt={RAIL.root.updatedAt} />
          </RailNode>

          <RailNode x={HEAD_X} y={LANE_0_Y}>
            <NodeLabel label={RAIL.head.label} emphasis="a" />
            <span className="bg-muted-foreground block size-2 rounded-full" />
            <RailNodeDate updatedAt={RAIL.head.updatedAt} />
          </RailNode>

          <RailNode x={FORK_X} y={LANE_1_Y}>
            <NodeLabel label={RAIL.fork.label} draft emphasis="b" />
            <span className="bg-muted-foreground block size-2 rounded-full" />
            <RailNodeDate updatedAt={RAIL.fork.updatedAt} />
          </RailNode>

          <span
            aria-hidden="true"
            className="bg-primary ring-primary/25 motion-safe:animate-variant-slide absolute block size-2 rounded-full ring-4"
            style={{
              ...SLIDE_STYLE,
              left: `calc(${railShare(HEAD_X)}% - ${DOT_SIZE / 2}px)`,
              top: LANE_0_Y - DOT_SIZE / 2,
            }}
          />
        </div>
      </div>

      <div className="grid">
        <StepDiff
          from={RAIL.root.title}
          to={RAIL.head.title}
          entries={RAIL.headDiff}
          emphasis="a"
        />
        <StepDiff
          from={RAIL.head.title}
          to={RAIL.fork.title}
          entries={RAIL.forkDiff}
          emphasis="b"
        />
      </div>
    </ClipFrame>
  );
}
