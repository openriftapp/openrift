import type { Marker, PrintingCitation } from "@openrift/shared/types/catalog";
import { LinkIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { BrandGlyph } from "@/components/ui/brand-glyph";
import { InfoHint } from "@/components/ui/info-hint";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { sourceBrand } from "@/features/admin/lib/source-brand";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

/** Also special-cased in card-thumbnail.tsx, for placeholder art. */
const PROMO_MARKER_SLUG = "promo";

function StopRowClick({ children }: { children: ReactNode }) {
  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- only stops the row behind from opening the card detail; the hint's own button takes the key events
    <span className="flex" onClick={(event) => event.stopPropagation()}>
      {children}
    </span>
  );
}

/** One citation as a single glyph: the source's brand mark, linked when there is somewhere to go, with the label in a tooltip. */
function CitationGlyph({ citation }: { citation: PrintingCitation }) {
  if (citation.sourceUrl === null) {
    return (
      <StopRowClick>
        <InfoHint label={citation.label} icon={LinkIcon} className="size-4 shrink-0">
          {citation.label}
        </InfoHint>
      </StopRowClick>
    );
  }

  const glyph = <BrandGlyph icon={sourceBrand(citation.sourceUrl)} fallback={LinkIcon} />;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            href={citation.sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={citation.label}
            className="hover:text-foreground"
            // The row behind this opens the card detail. A click or Enter on a
            // citation is aimed at the source, so it must not do both.
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.stopPropagation();
              }
            }}
          />
        }
      >
        {glyph}
      </TooltipTrigger>
      <TooltipContent>{citation.label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The note reads out in full (truncated) once the column is wide enough for
 * it; a narrower table shrinks it back to its icon, leaving the text to the
 * tooltip.
 */
export function PrintingNotesCell({
  comment,
  markers,
  citations,
  className,
}: {
  comment: string | null;
  /** The generic "Promo" marker is dropped: it sits on nearly every promo printing. */
  markers: readonly Marker[];
  /** Read as `printing.citations ?? []` — the wire schema omits an empty list. */
  citations: readonly PrintingCitation[];
  className?: string;
}) {
  const shownMarkers = markers.filter((marker) => marker.slug !== PROMO_MARKER_SLUG);
  if (!comment && shownMarkers.length === 0 && citations.length === 0) {
    return null;
  }
  return (
    // @container, not a viewport breakpoint: the column's width depends on the
    // fixed columns and the table's own scroll, not the screen size.
    <div className={cn("text-muted-foreground @container flex items-center gap-1.5", className)}>
      {comment && (
        <span className="flex min-w-0 items-center gap-1.5">
          <StopRowClick>
            <InfoHint label={m.cards_notes_printing_note()} className="size-4 shrink-0">
              {comment}
            </InfoHint>
          </StopRowClick>
          <span className="hidden truncate @[10rem]:inline">{comment}</span>
        </span>
      )}
      {shownMarkers.length > 0 && (
        <span className="flex min-w-0 shrink items-center gap-1">
          {shownMarkers.map((marker) => (
            <Badge
              key={marker.id}
              variant="secondary"
              title={marker.description ?? marker.label}
              className="min-w-0 shrink"
            >
              <span className="truncate">{marker.label}</span>
            </Badge>
          ))}
        </span>
      )}
      {citations.length > 0 && (
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {citations.map((citation) => (
            <CitationGlyph key={citation.id} citation={citation} />
          ))}
        </span>
      )}
    </div>
  );
}
