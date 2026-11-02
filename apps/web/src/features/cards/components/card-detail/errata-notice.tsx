import { formatMonth } from "@openrift/shared/format-date";
import type { CardErrata } from "@openrift/shared/types/catalog";
import { Link } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import { createContext, use } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { TextLink } from "@/components/ui/text-link";
import { CardText, CardTextTokens } from "@/features/cards/components/card-text";
import { ErrataGapGlyph, ErrataPane } from "@/features/cards/components/errata-diff-pane";
import { diffCardText, isBlankSegment, markCorrected } from "@/features/cards/lib/errata-diff";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export interface ErrataChange {
  key: "rules" | "effect";
  printed: string;
  corrected: string;
}

const ErrataMobileContext = createContext<boolean | null>(null);

function ErrataMark({
  mobile,
  gap = false,
  italic = false,
  children,
}: {
  mobile: boolean;
  gap?: boolean;
  italic?: boolean;
  children?: ReactNode;
}) {
  const Trigger = mobile ? DrawerTrigger : PopoverTrigger;
  return (
    <Trigger
      nativeButton={false}
      render={<span />}
      aria-label={gap ? m.card_detail_errata_mark_removed() : undefined}
      className={cn(
        "focus-visible:ring-ring relative cursor-pointer rounded-xs outline-none before:absolute before:content-[''] focus-visible:ring-2",
        gap
          ? "data-popup-open:bg-warning-soft mx-px inline-flex h-[1em] w-[0.75em] items-end justify-center align-[-0.15em] before:-inset-x-3 before:-inset-y-3"
          : "text-foreground decoration-warning data-popup-open:bg-warning-soft underline decoration-dotted decoration-2 underline-offset-4 before:-inset-x-1 before:-inset-y-2.5 data-popup-open:decoration-solid",
        italic && "italic",
      )}
    >
      {gap ? <ErrataGapGlyph /> : children}
      {!gap && <span className="sr-only"> ({m.card_detail_errata_mark_changed()})</span>}
    </Trigger>
  );
}

export function ErrataCardText({
  printed,
  corrected,
  onKeywordClick,
  interactive = true,
}: {
  printed: string;
  corrected: string;
  onKeywordClick?: (keyword: string) => void;
  interactive?: boolean;
}) {
  const mobile = use(ErrataMobileContext);
  if (mobile === null || corrected === printed) {
    return <CardText text={corrected} onKeywordClick={onKeywordClick} interactive={interactive} />;
  }
  return markCorrected(diffCardText(printed, corrected)).map((segment, index) => {
    if (segment.status === "gap") {
      // oxlint-disable-next-line react/no-array-index-key -- segments have no identity beyond their position
      return <ErrataMark key={index} mobile={mobile} gap />;
    }
    if (segment.status === "added" && !isBlankSegment(segment)) {
      return (
        // oxlint-disable-next-line react/no-array-index-key -- segments have no identity beyond their position
        <ErrataMark key={index} mobile={mobile} italic={segment.italic}>
          <CardTextTokens tokens={segment.tokens} />
        </ErrataMark>
      );
    }
    return (
      // oxlint-disable-next-line react/no-array-index-key -- segments have no identity beyond their position
      <span key={index} className={cn(segment.italic && "italic")}>
        <CardTextTokens
          tokens={segment.tokens}
          onKeywordClick={onKeywordClick}
          interactive={interactive}
        />
      </span>
    );
  });
}

function ErrataComparison({
  cardSlug,
  errata,
  changes,
  lang,
  title,
}: {
  cardSlug: string;
  errata: CardErrata;
  changes: ErrataChange[];
  lang?: string;
  title: ReactNode;
}) {
  return (
    <>
      {title}
      {changes.map((change) => {
        const list = [
          {
            key: change.key,
            label: null,
            segments: diffCardText(change.printed, change.corrected),
          },
        ];
        return (
          <section key={change.key} className="flex flex-col gap-1.5">
            {changes.length > 1 && (
              <p className="text-muted-foreground font-medium">
                {change.key === "rules" ? m.card_detail_errata_rules() : m.errata_pane_effect()}
              </p>
            )}
            <div lang={lang} className="flex flex-col gap-1.5">
              <ErrataPane
                title={m.errata_pane_printed()}
                tone="printed"
                changes={list}
                side="printed"
                className="px-3 py-2"
              />
              <ErrataPane
                title={m.errata_pane_updated()}
                tone="updated"
                changes={list}
                side="corrected"
                className="px-3 py-2"
              />
            </div>
          </section>
        );
      })}
      <p className="text-muted-foreground flex flex-wrap gap-x-1.5 text-xs">
        <span>
          {m.card_detail_errata_source()}{" "}
          {errata.sourceUrl ? (
            <TextLink variant="muted" href={errata.sourceUrl} target="_blank" rel="noreferrer">
              {errata.source}
            </TextLink>
          ) : (
            errata.source
          )}
        </span>
        <span aria-hidden>&middot;</span>
        <TextLink variant="muted" render={<Link to="/errata" hash={cardSlug} />}>
          {m.card_detail_errata_all()}
        </TextLink>
      </p>
    </>
  );
}

function ErrataHeading({ errata }: { errata: CardErrata }) {
  return (
    <>
      {m.card_detail_errata_label()}
      {errata.effectiveDate && (
        <span className="text-muted-foreground font-normal">
          {" "}
          &middot; {formatMonth(errata.effectiveDate)}
        </span>
      )}
    </>
  );
}

export function ErrataScope({
  cardSlug,
  errata,
  changes,
  lang,
  children,
}: {
  cardSlug: string;
  errata: CardErrata | null;
  changes: ErrataChange[];
  lang?: string;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  if (errata === null || changes.length === 0) {
    return children;
  }

  return (
    <div>
      <ErrataMobileContext value={isMobile}>
        {isMobile ? (
          <Drawer showSwipeHandle>
            {children}
            <DrawerContent>
              <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-4 pt-1 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <ErrataComparison
                  cardSlug={cardSlug}
                  errata={errata}
                  changes={changes}
                  lang={lang}
                  title={
                    <div className="flex items-center justify-between gap-2">
                      <DrawerTitle>
                        <ErrataHeading errata={errata} />
                      </DrawerTitle>
                      <DrawerClose
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="-mr-3 size-11"
                            aria-label={m.common_close()}
                          />
                        }
                      >
                        <XIcon />
                      </DrawerClose>
                    </div>
                  }
                />
              </div>
            </DrawerContent>
          </Drawer>
        ) : (
          <Popover>
            {children}
            <PopoverContent
              side="bottom"
              align="start"
              className="max-h-(--available-height) w-[min(24rem,calc(100vw-2rem))] gap-3 overflow-y-auto p-3"
            >
              <ErrataComparison
                cardSlug={cardSlug}
                errata={errata}
                changes={changes}
                lang={lang}
                title={
                  <PopoverTitle>
                    <ErrataHeading errata={errata} />
                  </PopoverTitle>
                }
              />
            </PopoverContent>
          </Popover>
        )}
      </ErrataMobileContext>
    </div>
  );
}
