import { enumLabel } from "@openrift/shared/enum-label";
import { imageUrl } from "@openrift/shared/image-url";
import type { SetListEntry } from "@openrift/shared/types/api/catalog";
import { WellKnown } from "@openrift/shared/well-known";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarIcon, LayersIcon } from "lucide-react";

import { Heading } from "@/components/heading";
import { PageHero, PageHeroCardFan } from "@/components/layout/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cardLinkVariants } from "@/components/ui/card-link";
import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { OrnamentRule } from "@/components/ui/ornament";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { CARD_BORDER_RADIUS } from "@/features/cards/lib/card-grid-constants";
import { publicSetListQueryOptions } from "@/features/cards/lib/public-sets-queries";
import {
  isSetUpcoming,
  otherReleases,
  primaryRelease,
  releaseDateText,
  releaseStatusText,
  setsOverviewSentence,
} from "@/features/cards/lib/set-hero-copy";
import { useLanguageLabels } from "@/hooks/use-enums";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn, PAGE_PADDING_NO_TOP } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

function SetCover({ set }: { set: SetListEntry }) {
  if (set.coverImageId) {
    return (
      <>
        <div className="aspect-card bg-muted" />
        {/* fallback null: the spacer above already matches the no-cover tile. */}
        <ImgWithFallback
          src={imageUrl(set.coverImageId, "400w")}
          srcSet={`${imageUrl(set.coverImageId, "400w")} 400w, ${imageUrl(set.coverImageId, "full")} 800w`}
          sizes="144px"
          alt={set.name}
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
          style={{ borderRadius: `${CARD_BORDER_RADIUS} 0 0 ${CARD_BORDER_RADIUS}` }}
          fallback={null}
        />
      </>
    );
  }
  return (
    <div
      aria-hidden="true"
      className="aspect-card bg-muted/30 flex flex-col items-center justify-center gap-2 px-3"
    >
      <OrnamentRule fade="tips" className="w-full" />
      <span className="font-heading text-2xl font-semibold tracking-wide">{set.slug}</span>
      <OrnamentRule fade="tips" className="w-full" />
    </div>
  );
}

function ReleaseDate({ set, languages }: { set: SetListEntry; languages: readonly string[] }) {
  const languageLabels = useLanguageLabels();
  const primary = primaryRelease(set.releases, languages);
  const others = otherReleases(set.releases, languages);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className="flex items-center gap-1.5">
        <CalendarIcon className="size-3.5 shrink-0" />
        {primary === undefined ? m.sets_release_tba() : releaseStatusText(primary.release)}
      </span>
      {others.length > 0 && (
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="link-muted"
                className="relative z-10 h-auto p-0 pointer-coarse:-my-3 pointer-coarse:py-3"
              />
            }
          >
            {m.sets_more_languages({ count: others.length })}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto min-w-48 gap-1.5">
            {others.map(({ language, release }) => (
              <div key={language} className="flex justify-between gap-4">
                <span className="text-muted-foreground">{enumLabel(languageLabels, language)}</span>
                <span className="tabular-nums">{releaseDateText(release)}</span>
              </div>
            ))}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

function SetCounts({ set }: { set: SetListEntry }) {
  if (set.cardCount === 0) {
    return (
      <span className="flex items-center gap-1.5">
        <LayersIcon className="size-3.5 shrink-0" />
        {m.sets_no_cards_yet()}
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <LayersIcon className="size-3.5 shrink-0" />
        {m.common_cards({ count: set.cardCount })}
      </span>
      <span className="whitespace-nowrap">{m.common_printings({ count: set.printingCount })}</span>
    </span>
  );
}

const SSR_CARD_LANGUAGES: readonly string[] = ["EN"];

function useCardLanguages(): readonly string[] {
  const hydrated = useHydrated();
  const languages = useDisplayStore((state) => state.languages);
  return hydrated && languages.length > 0 ? languages : SSR_CARD_LANGUAGES;
}

function HeroSetCard({ set }: { set: SetListEntry }) {
  const languages = useCardLanguages();
  const upcoming = isSetUpcoming(set, languages);
  return (
    <Card className={cn(cardLinkVariants(), "relative h-full flex-row gap-0 py-0")}>
      <div className="relative w-28 shrink-0 sm:w-36">
        <SetCover set={set} />
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-1 p-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Heading className="truncate">
            <Link
              to="/sets/$setSlug"
              params={{ setSlug: set.slug }}
              className="focus-visible:after:ring-ring/50 rounded-lg no-underline outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2"
            >
              {set.name}
            </Link>
          </Heading>
          {upcoming && <Badge variant="subtle">{m.sets_upcoming()}</Badge>}
        </div>
        <div className="text-muted-foreground flex flex-col gap-1 text-sm">
          <SetCounts set={set} />
          <ReleaseDate set={set} languages={languages} />
        </div>
      </div>
    </Card>
  );
}

// grid-cols-1 matters: without it the implicit column is content-sized and
// wider than a phone viewport, clipping the row's date and title.
const SET_GRID = "grid grid-cols-1 gap-4 min-[1920px]:grid-cols-4 sm:grid-cols-2 xl:grid-cols-3";

export function SetsPage() {
  const { data } = useSuspenseQuery(publicSetListQueryOptions);

  const mainSets = data.sets.filter((s) => s.setType === WellKnown.setType.MAIN);
  const supplementalSets = data.sets.filter((s) => s.setType !== WellKnown.setType.MAIN);
  const coverUrls = mainSets
    .flatMap((set) => (set.coverImageId ? [imageUrl(set.coverImageId, "400w")] : []))
    .toReversed()
    .slice(0, 3);

  return (
    <>
      <PageHero
        width="full"
        title={m.sets_title()}
        lead={setsOverviewSentence(data.sets) ?? undefined}
        aside={<PageHeroCardFan urls={coverUrls} />}
      />
      <div className={cn("pt-3", PAGE_PADDING_NO_TOP)}>
        <div className={SET_GRID}>
          {mainSets.map((set) => (
            <HeroSetCard key={set.id} set={set} />
          ))}
        </div>
        {supplementalSets.length > 0 && (
          <>
            <Heading className="mt-10 mb-6">{m.sets_supplemental()}</Heading>
            <div className={SET_GRID}>
              {supplementalSets.map((set) => (
                <HeroSetCard key={set.id} set={set} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export function SetsPending() {
  return (
    <>
      <PageHero width="full" title={m.sets_title()} />
      <div className={cn("pt-3", PAGE_PADDING_NO_TOP)}>
        <div className={SET_GRID}>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      </div>
    </>
  );
}
