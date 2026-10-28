import { legendDisplayName } from "@openrift/shared/card-name";
import { getOrientation } from "@openrift/shared/card-orientation";
import { imageUrl } from "@openrift/shared/image-url";
import { sideKey } from "@openrift/shared/printing-side";
import { findStandardArtFallback } from "@openrift/shared/standard";
import type { Printing } from "@openrift/shared/types/catalog";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { CardPlaceholderImage } from "@/features/cards/components/card-placeholder-image";
import { DoubleSidedFlip } from "@/features/cards/components/double-sided-flip";
import { FallbackArtBadges } from "@/features/cards/components/fallback-art-badges";
import { SuggestImageNotice } from "@/features/cards/components/suggest-image-notice";
import { otherSideOf, otherSideSearchSide } from "@/features/cards/lib/printing-designs";

export function CardPageHero({
  printing,
  siblings,
  otherCardSides,
  top,
  children,
}: {
  printing: Printing;
  siblings: Printing[];
  otherCardSides: Printing[];
  top?: ReactNode;
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  const otherSide = printing.otherSide;
  const allSides = [...siblings, ...otherCardSides];
  const otherSidePrinting = otherSide ? otherSideOf(printing, allSides) : undefined;
  const heroArt = <HeroArt printing={printing} siblings={siblings} priority />;

  return (
    <div className="flex shrink-0 flex-col gap-3 md:w-80">
      {top}
      {otherSide ? (
        <DoubleSidedFlip
          key={sideKey(printing)}
          otherSide={otherSide}
          back={
            otherSidePrinting && (
              <HeroArt
                printing={otherSidePrinting}
                siblings={allSides.filter((side) => side.cardId === otherSidePrinting.cardId)}
              />
            )
          }
          onFlip={() =>
            void navigate({
              to: "/cards/$cardSlug/{-$printingSlug}",
              params: { cardSlug: otherSide.cardSlug, printingSlug: printing.slug },
              search: { side: otherSideSearchSide(printing) },
            })
          }
          renderLink={(pill) => (
            <Link
              to="/cards/$cardSlug/{-$printingSlug}"
              params={{ cardSlug: otherSide.cardSlug, printingSlug: printing.slug }}
              search={{ side: otherSideSearchSide(printing) }}
              {...pill}
            />
          )}
        >
          {heroArt}
        </DoubleSidedFlip>
      ) : (
        heroArt
      )}
      {children}
    </div>
  );
}

function HeroArt({
  printing,
  siblings,
  priority,
}: {
  printing: Printing;
  siblings: Printing[];
  priority?: boolean;
}) {
  const { card } = printing;
  const frontImage = printing.images[0];
  const isLandscape = getOrientation(card.types) === "landscape";
  const heroWidth = isLandscape ? 558 : 400;
  const heroHeight = isLandscape ? 400 : 558;
  const fetchPriority = priority ? "high" : undefined;
  const heroPlaceholder = (
    <CardPlaceholderImage
      name={card.name}
      domain={card.domains}
      energy={card.energy}
      might={card.might}
      power={card.power}
      types={card.types}
      superTypes={card.superTypes}
      tags={card.tags}
      rulesText={printing.printedRulesText}
      effectText={printing.printedEffectText}
      mightBonus={card.mightBonus}
      flavorText={printing.flavorText}
      rarity={printing.rarity}
      publicCode={printing.publicCode}
      artist={printing.artist}
      className="w-full rounded-xl"
    />
  );

  const heroFallbackArt = findStandardArtFallback(printing, siblings);
  const heroFallback = heroFallbackArt ? (
    <div className="relative">
      <ImgWithFallback
        src={imageUrl(heroFallbackArt.image.imageId, "400w")}
        srcSet={`${imageUrl(heroFallbackArt.image.imageId, "400w")} 400w, ${imageUrl(heroFallbackArt.image.imageId, "full")} 800w`}
        sizes="(min-width: 768px) 320px, 100vw"
        width={heroWidth}
        height={heroHeight}
        fetchPriority={fetchPriority}
        alt={legendDisplayName(card)}
        className="w-full rounded-xl"
        fallback={heroPlaceholder}
      />
      <FallbackArtBadges printing={printing} artPrinting={heroFallbackArt.printing} />
      <SuggestImageNotice printing={printing} />
    </div>
  ) : (
    heroPlaceholder
  );

  return frontImage ? (
    <ImgWithFallback
      src={imageUrl(frontImage.imageId, "400w")}
      srcSet={`${imageUrl(frontImage.imageId, "400w")} 400w, ${imageUrl(frontImage.imageId, "full")} 800w`}
      sizes="(min-width: 768px) 320px, 100vw"
      width={heroWidth}
      height={heroHeight}
      fetchPriority={fetchPriority}
      alt={legendDisplayName(card)}
      className="w-full rounded-xl"
      fallback={heroFallback}
    />
  ) : (
    heroFallback
  );
}
