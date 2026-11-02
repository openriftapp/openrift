import { Eyebrow } from "@/components/heading";
import { CardTextTokens } from "@/features/cards/components/card-text";
import type { ErrataDiffSegment, ErrataMarkedSegment } from "@/features/cards/lib/errata-diff";
import { diffSide, isBlankSegment, markCorrected } from "@/features/cards/lib/errata-diff";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function ErrataGapGlyph({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 10 8"
      fill="currentColor"
      className={cn("text-warning h-[0.5em] w-[0.625em]", className)}
    >
      <path d="M5 0 10 8H0z" />
    </svg>
  );
}

function DiffText({ segments }: { segments: ErrataMarkedSegment[] }) {
  return (
    <p className="leading-relaxed">
      {segments.map((segment, index) => {
        if (segment.status === "gap") {
          return (
            // oxlint-disable-next-line react/no-array-index-key -- segments have no identity beyond their position
            <span key={index} className="mx-px inline-flex h-[1em] items-end align-[-0.15em]">
              <ErrataGapGlyph />
              <span className="sr-only">{m.card_detail_errata_removed_here()}</span>
            </span>
          );
        }
        const content = <CardTextTokens tokens={segment.tokens} />;
        const italic = segment.italic && "italic";
        if (segment.status === "same" || isBlankSegment(segment)) {
          // oxlint-disable-next-line react/no-array-index-key -- segments have no identity beyond their position
          return (
            <span key={index} className={cn(italic)}>
              {content}
            </span>
          );
        }
        if (segment.status === "added") {
          return (
            // oxlint-disable-next-line react/no-array-index-key -- segments have no identity beyond their position
            <ins
              key={index}
              className={cn(
                "bg-warning-soft decoration-warning rounded-xs underline decoration-2 underline-offset-2",
                italic,
              )}
            >
              {content}
            </ins>
          );
        }
        return (
          // oxlint-disable-next-line react/no-array-index-key -- segments have no identity beyond their position
          <del
            key={index}
            className={cn(
              "text-muted-foreground decoration-destructive line-through decoration-2",
              italic,
            )}
          >
            {content}
          </del>
        );
      })}
    </p>
  );
}

export interface ErrataTextChange {
  key: string;
  label: string | null;
  segments: ErrataDiffSegment[];
}

function sideSegments(
  segments: ErrataDiffSegment[],
  side: "printed" | "corrected" | null,
): ErrataMarkedSegment[] {
  if (side === "printed") {
    return diffSide(segments, "printed");
  }
  return side === "corrected" ? markCorrected(segments) : segments;
}

export function ErrataPane({
  title,
  tone,
  changes,
  side,
  className,
}: {
  title: string;
  tone: "printed" | "updated";
  changes: ErrataTextChange[];
  side: "printed" | "corrected" | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-lg px-3.5 py-3",
        tone === "printed" ? "bg-muted/60" : "bg-card ring-warning/40 ring-1",
        className,
      )}
    >
      <Eyebrow
        as="p"
        className={cn(
          "mb-0 text-xs",
          tone === "printed" ? "text-muted-foreground" : "text-warning",
        )}
      >
        {title}
      </Eyebrow>
      {changes.map((change) => (
        <div key={change.key}>
          {change.label !== null && (
            <p className="text-muted-foreground text-xs font-medium">{change.label}</p>
          )}
          <DiffText segments={sideSegments(change.segments, side)} />
        </div>
      ))}
    </div>
  );
}
