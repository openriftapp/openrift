import { legendDisplayName } from "@openrift/shared/card-name";
import type { ErrataEntry as ErrataEntryData } from "@openrift/shared/contracts/errata";
import { enumLabel } from "@openrift/shared/enum-label";
import { formatDay } from "@openrift/shared/format-date";
import { imageUrl } from "@openrift/shared/image-url";
import { Link } from "@tanstack/react-router";
import { InfoIcon } from "lucide-react";

import { Eyebrow } from "@/components/heading";
import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { TextLink } from "@/components/ui/text-link";
import { CardTextTokens } from "@/features/cards/components/card-text";
import { CARD_BORDER_RADIUS } from "@/features/cards/lib/card-grid-constants";
import type { ErrataDiffSegment } from "@/features/cards/lib/errata-diff";
import { diffCardText, diffSide, isBlankSegment } from "@/features/cards/lib/errata-diff";
import { useEnumOrders } from "@/hooks/use-enums";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export type ErrataView = "side" | "inline";

function DiffText({ segments }: { segments: ErrataDiffSegment[] }) {
  return (
    <p className="leading-relaxed">
      {segments.map((segment, index) => {
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

interface TextChange {
  key: string;
  label: string | null;
  segments: ErrataDiffSegment[];
}

function textChanges(entry: ErrataEntryData): TextChange[] {
  const changes: TextChange[] = [];
  if (entry.correctedRulesText !== null) {
    changes.push({
      key: "rules",
      label: null,
      segments: diffCardText(entry.printing?.printedRulesText ?? "", entry.correctedRulesText),
    });
  }
  if (entry.correctedEffectText !== null) {
    changes.push({
      key: "effect",
      label: m.errata_pane_effect(),
      segments: diffCardText(entry.printing?.printedEffectText ?? "", entry.correctedEffectText),
    });
  }
  return changes;
}

function Pane({
  title,
  tone,
  changes,
  side,
}: {
  title: string;
  tone: "printed" | "updated";
  changes: TextChange[];
  side: "printed" | "corrected" | null;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-lg px-3.5 py-3",
        tone === "printed" ? "bg-muted/60" : "bg-card ring-warning/40 ring-1",
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
          <DiffText segments={side === null ? change.segments : diffSide(change.segments, side)} />
        </div>
      ))}
    </div>
  );
}

function sourceNote(entry: ErrataEntryData): string | null {
  if (entry.announcementId !== null || entry.source === null) {
    return null;
  }
  return entry.effectiveDate === null
    ? entry.source
    : `${entry.source}, ${m.errata_first_seen({ date: formatDay(entry.effectiveDate) })}`;
}

export function ErrataEntry({ entry, view }: { entry: ErrataEntryData; view: ErrataView }) {
  const { labels, domainColors } = useEnumOrders();
  const name = legendDisplayName(entry.card);
  const changes = textChanges(entry);
  const note = sourceNote(entry);
  const meta = [
    entry.card.types.map((type) => enumLabel(labels.cardTypes, type)).join(" "),
    entry.printing?.shortCode,
  ].filter((part) => part !== undefined && part !== "");

  return (
    <article
      id={entry.card.slug}
      className="grid scroll-mt-40 grid-cols-[4rem_minmax(0,1fr)] gap-3.5 border-b py-5 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-5"
    >
      <Link
        to="/cards/$cardSlug/{-$printingSlug}"
        params={{ cardSlug: entry.card.slug }}
        aria-label={m.errata_card_page_aria({ name })}
        className="bg-muted aspect-card block min-w-0 self-start overflow-hidden shadow-sm"
        style={{ borderRadius: CARD_BORDER_RADIUS }}
      >
        {entry.printing?.imageId ? (
          <ImgWithFallback
            src={imageUrl(entry.printing.imageId, "240w")}
            srcSet={`${imageUrl(entry.printing.imageId, "240w")} 240w, ${imageUrl(entry.printing.imageId, "400w")} 400w`}
            sizes="96px"
            alt=""
            loading="lazy"
            className="size-full object-contain"
            fallback={null}
          />
        ) : null}
      </Link>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-base font-semibold">
            <TextLink
              variant="inherit"
              render={
                <Link
                  to="/cards/$cardSlug/{-$printingSlug}"
                  params={{ cardSlug: entry.card.slug }}
                />
              }
            >
              {name}
            </TextLink>
          </h3>
          <span className="text-muted-foreground flex items-center gap-2 text-sm">
            {entry.card.domains.length > 0 && (
              <span aria-hidden className="flex gap-0.5">
                {entry.card.domains.map((domain) => (
                  <span
                    key={domain}
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: domainColors[domain] }}
                  />
                ))}
              </span>
            )}
            {meta.join(" · ")}
          </span>
        </div>
        {note !== null && (
          <p className="text-muted-foreground -mt-1.5 flex items-center gap-1.5 text-sm">
            <InfoIcon className="size-4 shrink-0" />
            {entry.sourceUrl === null ? (
              note
            ) : (
              <TextLink variant="muted" href={entry.sourceUrl} target="_blank" rel="noreferrer">
                {note}
              </TextLink>
            )}
          </p>
        )}
        {view === "side" ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
            <Pane title={m.errata_pane_printed()} tone="printed" changes={changes} side="printed" />
            <Pane
              title={m.errata_pane_updated()}
              tone="updated"
              changes={changes}
              side="corrected"
            />
          </div>
        ) : (
          <Pane title={m.errata_pane_updated()} tone="updated" changes={changes} side={null} />
        )}
      </div>
    </article>
  );
}
