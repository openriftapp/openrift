import { legendDisplayName } from "@openrift/shared/card-name";
import type { ErrataEntry as ErrataEntryData } from "@openrift/shared/contracts/errata";
import { enumLabel } from "@openrift/shared/enum-label";
import { formatDay } from "@openrift/shared/format-date";
import { imageUrl } from "@openrift/shared/image-url";
import { WellKnown } from "@openrift/shared/well-known";
import { Link } from "@tanstack/react-router";
import { InfoIcon } from "lucide-react";

import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { TextLink } from "@/components/ui/text-link";
import type { ErrataTextChange } from "@/features/cards/components/errata-diff-pane";
import { ErrataPane } from "@/features/cards/components/errata-diff-pane";
import { CARD_BORDER_RADIUS } from "@/features/cards/lib/card-grid-constants";
import { diffCardText } from "@/features/cards/lib/errata-diff";
import { errataEntryAnchor } from "@/features/cards/lib/errata-list";
import { distinctPrintingCode } from "@/features/cards/lib/printing-search-link";
import { useEnumOrders, useLanguageLabels } from "@/hooks/use-enums";
import { htmlLangTag } from "@/lib/language-tag";
import { m } from "@/paraglide/messages.js";

export type ErrataView = "side" | "inline";

function textChanges(entry: ErrataEntryData): ErrataTextChange[] {
  const changes: ErrataTextChange[] = [];
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
  const languageLabels = useLanguageLabels();
  const isEnglish = entry.language === WellKnown.language.EN;
  const name = legendDisplayName(entry.card);
  const changes = textChanges(entry);
  const note = sourceNote(entry);
  const meta = [
    entry.card.types.map((type) => enumLabel(labels.cardTypes, type)).join(" "),
    entry.printing && distinctPrintingCode(entry.printing),
    isEnglish ? undefined : enumLabel(languageLabels, entry.language),
  ].filter((part) => part !== undefined && part !== "");

  return (
    <article
      id={errataEntryAnchor(entry.card.slug, entry.language)}
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
        <div lang={htmlLangTag(entry.language)}>
          {view === "side" ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
              <ErrataPane
                title={m.errata_pane_printed()}
                tone="printed"
                changes={changes}
                side="printed"
              />
              <ErrataPane
                title={m.errata_pane_updated()}
                tone="updated"
                changes={changes}
                side="corrected"
              />
            </div>
          ) : (
            <ErrataPane
              title={m.errata_pane_updated()}
              tone="updated"
              changes={changes}
              side={null}
            />
          )}
        </div>
      </div>
    </article>
  );
}
