import { imageUrl } from "@openrift/shared/image-url";
import type { Printing } from "@openrift/shared/types/catalog";
import { deduplicateByCard } from "@openrift/shared/utils";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createLazyFileRoute, useNavigate } from "@tanstack/react-router";

import {
  PAGE_HERO_EYEBROW_CLASS,
  PageHero,
  PageHeroCardFan,
  PageHeroStats,
} from "@/components/layout/page-hero";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CardThumbnail } from "@/features/cards/components/card-thumbnail";
import { useCardThumbnailDisplay } from "@/features/cards/hooks/use-card-thumbnail-display";
import { publicSetDetailQueryOptions } from "@/features/cards/lib/public-sets-queries";
import { setReleaseSentence } from "@/features/cards/lib/set-hero-copy";
import { useEffectiveLanguageOrder } from "@/hooks/use-effective-language-order";
import { cn, PAGE_PADDING_NO_TOP } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

export const Route = createLazyFileRoute("/_app/sets_/$setSlug")({
  component: SetDetailPage,
  pendingComponent: SetDetailPending,
});

// Must mirror SET_GRID's breakpoints; fixed px above the container width cap.
const SETS_CARD_SIZES =
  "(min-width: 2560px) 291px, (min-width: 2160px) 240px, (min-width: 1720px) 186px, (min-width: 1536px) 131px, (min-width: 1280px) 184px, (min-width: 1024px) calc((100vw - 88px) / 5 - 12px), (min-width: 768px) calc((100vw - 72px) / 4 - 12px), (min-width: 640px) calc((100vw - 56px) / 3 - 12px), calc((100vw - 40px) / 2 - 12px)";

const SET_GRID =
  "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8";

function SetDetailPage() {
  const { setSlug } = Route.useParams();
  const { data } = useSuspenseQuery(publicSetDetailQueryOptions(setSlug));
  const navigate = useNavigate();
  const showImages = useDisplayStore((s) => s.showImages);
  const display = useCardThumbnailDisplay();
  const effectiveLanguageOrder = useEffectiveLanguageOrder();

  const uniquePrintings = deduplicateByCard(data.printings, effectiveLanguageOrder);
  const printingsByCardId = Map.groupBy(data.printings, (printing) => printing.cardId);
  const fanUrls = uniquePrintings
    .flatMap((printing) =>
      printing.images[0] ? [imageUrl(printing.images[0].imageId, "400w")] : [],
    )
    .slice(0, 3);

  const handleCardClick = (printing: Printing) => {
    void navigate({
      to: "/cards/$cardSlug/{-$printingSlug}",
      params: { cardSlug: printing.card.slug },
    });
  };

  return (
    <>
      <PageHero
        width="full"
        eyebrow={
          <span className={cn(PAGE_HERO_EYEBROW_CLASS, "flex items-center gap-1.5")}>
            <Link to="/sets" className="hover:underline">
              {m.sets_title()}
            </Link>
            <span aria-hidden="true" className="text-muted-foreground">
              /
            </span>
            {data.set.slug} ·{" "}
            {data.set.setType === "main" ? m.set_type_main_set() : m.set_type_supplemental_set()}
          </span>
        }
        title={data.set.name}
        lead={setReleaseSentence(data.set.releases) ?? undefined}
        aside={<PageHeroCardFan urls={fanUrls} />}
      >
        <PageHeroStats
          stats={[
            { key: "cards", label: m.hero_stat_cards(), value: uniquePrintings.length },
            { key: "printings", label: m.hero_stat_printings(), value: data.printings.length },
          ]}
        />
        <Button className="mt-3" render={<Link to="/cards" search={{ sets: [setSlug] }} />}>
          {m.sets_open_in_browser()}
        </Button>
      </PageHero>

      <div className={cn("pt-3", PAGE_PADDING_NO_TOP)}>
        <div className={SET_GRID}>
          {uniquePrintings.map((printing) => (
            <CardThumbnail
              key={printing.id}
              printing={printing}
              onClick={handleCardClick}
              showImages={showImages}
              display={display}
              sizes={SETS_CARD_SIZES}
              view="cards"
              siblings={printingsByCardId.get(printing.cardId)}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function SetDetailPending() {
  return (
    <>
      <PageHero width="full" title={<Skeleton className="h-12 w-64" />} />
      <div className={cn("pt-3", PAGE_PADDING_NO_TOP)}>
        <div className={SET_GRID}>
          {Array.from({ length: 20 }, (_, i) => (
            <div key={i} className="p-1.5">
              <Skeleton className="aspect-card rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
