import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { CardDetailArt } from "@/features/cards/components/card-detail/card-detail-art";
import { DoubleSidedFlip } from "@/features/cards/components/double-sided-flip";
import { otherSideOf, otherSideSearchSide } from "@/features/cards/lib/printing-designs";
import { useHydrated } from "@/hooks/use-hydrated";
import { useDisplayStore } from "@/stores/display-store";

const HERO_SIZES = "(min-width: 768px) 320px, 100vw";

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
  const hydrated = useHydrated();
  const prefersImages = useDisplayStore((state) => state.showImages);
  // The server cannot see the persisted preference, so the first client render matches it.
  const showImages = !hydrated || prefersImages;
  const otherSide = printing.otherSide;
  const otherSidePrinting = otherSide
    ? otherSideOf(printing, [...siblings, ...otherCardSides])
    : undefined;
  const heroArt = (
    <CardDetailArt printing={printing} showImages={showImages} sizes={HERO_SIZES} frame="native" />
  );

  return (
    <div className="flex shrink-0 flex-col gap-3 md:w-80">
      {top}
      {otherSide ? (
        <DoubleSidedFlip
          key={sideKey(printing)}
          otherSide={otherSide}
          back={
            otherSidePrinting && (
              <CardDetailArt
                printing={otherSidePrinting}
                showImages={showImages}
                sizes={HERO_SIZES}
                loading="lazy"
                frame="native"
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
