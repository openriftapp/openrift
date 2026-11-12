import type { MetaListShape } from "@openrift/shared/types/api/meta";
import type { DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";

import { describeListShape, listShapeSegments } from "@/features/meta/lib/meta-inferred";
import type { ShapeSegmentState } from "@/features/meta/lib/meta-inferred";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const STATE_CLASS: Record<ShapeSegmentState, string> = {
  known: "bg-muted-foreground",
  inferred: "bg-primary",
  unknown: "bg-muted",
};

const GROUP: Partial<Record<DeckZone, number>> = {
  [WellKnown.deckZone.LEGEND]: 0,
  [WellKnown.deckZone.CHAMPION]: 0,
  [WellKnown.deckZone.BATTLEFIELD]: 1,
  [WellKnown.deckZone.MAIN]: 2,
  [WellKnown.deckZone.RUNES]: 2,
};

function Swatch({ state, className }: { state: ShapeSegmentState; className?: string }) {
  return (
    <span aria-hidden className={cn("block h-2 w-1.5 rounded-xs", STATE_CLASS[state], className)} />
  );
}

export function MetaListShapeBar({
  shape,
  className,
}: {
  shape: MetaListShape;
  className?: string;
}) {
  const description = describeListShape(shape);
  if (description === "") {
    return null;
  }
  const segments = listShapeSegments(shape);
  return (
    <span
      role="img"
      aria-label={description}
      title={description}
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      {segments.map((segment, index) => {
        const previous = segments[index - 1];
        const startsGroup = previous !== undefined && GROUP[previous.zone] !== GROUP[segment.zone];
        const bar = segment.fill !== undefined;
        const width = segment.zone === WellKnown.deckZone.MAIN ? "w-4" : "w-2.5";
        return (
          <span
            key={segment.key}
            aria-hidden
            className={cn(
              "block h-2 overflow-hidden rounded-xs",
              bar ? width : "w-1.5",
              startsGroup && "ml-1",
              bar ? STATE_CLASS.unknown : STATE_CLASS[segment.state],
            )}
          >
            {bar && (
              <span
                className={cn("block h-full", STATE_CLASS.known)}
                style={{ width: `${(segment.fill ?? 0) * 100}%` }}
              />
            )}
          </span>
        );
      })}
    </span>
  );
}

export function MetaListShapeKey({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs",
        className,
      )}
    >
      <span>{m.meta_shape_key_parts()}</span>
      <span className="inline-flex items-center gap-1.5">
        <Swatch state="known" />
        {m.meta_shape_key_known()}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Swatch state="inferred" />
        {m.meta_shape_key_inferred()}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Swatch state="unknown" />
        {m.meta_shape_key_unknown()}
      </span>
    </p>
  );
}
