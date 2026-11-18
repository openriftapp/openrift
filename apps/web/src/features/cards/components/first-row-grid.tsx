import { enumLabel } from "@openrift/shared/enum-label";
import { imageSrcSet, imageUrl } from "@openrift/shared/image-url";
import { sideKey } from "@openrift/shared/printing-side";
import { getRouteApi } from "@tanstack/react-router";

import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { OrnamentRule } from "@/components/ui/ornament";
import {
  SSR_RESPONSIVE_GRID_COLS,
  SSR_RESPONSIVE_GRID_GAP,
} from "@/features/cards/hooks/use-responsive-columns";
import { BUTTON_PAD_CLASS, LABEL_HEIGHT } from "@/features/cards/lib/card-grid-constants";
import { LANDSCAPE_ROTATION_STYLE } from "@/lib/images";
import { cn } from "@/lib/utils";

const cardsRoute = getRouteApi("/_app/cards");

/** Full class strings required for Tailwind's scanner: don't concatenate dynamically. */
function visibilityForIndex(i: number): string {
  if (i < 4) {
    return "";
  }
  if (i < 6) {
    return "hidden @min-[640px]/grid:block";
  }
  if (i < 8) {
    return "hidden @min-[768px]/grid:block";
  }
  if (i < 10) {
    return "hidden @min-[1024px]/grid:block";
  }
  if (i < 12) {
    return "hidden @min-[1280px]/grid:block";
  }
  if (i < 14) {
    return "hidden @min-[1600px]/grid:block";
  }
  return "hidden @min-[1920px]/grid:block";
}

/**
 * The server-rendered first row of the cards page, shown in the grid slot until
 * the catalogue loads. It must pixel-match the live grid's first row.
 */
export function FirstRowGrid() {
  const { firstRow, setLabels } = cardsRoute.useLoaderData();
  if (firstRow.length === 0) {
    return null;
  }

  return (
    // Header-to-cards gap must match the virtualizer's row gap for hydration parity.
    <div className={cn("flex flex-col", SSR_RESPONSIVE_GRID_GAP)}>
      <OrnamentRule fade="tips" className="pt-4 pb-2" aria-hidden="true">
        <span className="flex flex-row gap-3 text-sm">
          <span className="text-muted-foreground font-medium">{firstRow[0]?.setSlug}</span>
          <span className="font-semibold">{enumLabel(setLabels, firstRow[0]?.setSlug ?? "")}</span>
        </span>
      </OrnamentRule>
      <div className={cn("grid", SSR_RESPONSIVE_GRID_COLS, SSR_RESPONSIVE_GRID_GAP)}>
        {firstRow.map((card, i) => {
          if (card.imageId === null) {
            return (
              <div
                key={sideKey(card)}
                className={cn("rounded-lg", BUTTON_PAD_CLASS, visibilityForIndex(i))}
              >
                <div
                  role="img"
                  aria-label={card.cardName}
                  className="aspect-card bg-muted w-full rounded-lg"
                />
                <div aria-hidden="true" style={{ height: LABEL_HEIGHT }} />
              </div>
            );
          }
          const srcSet = imageSrcSet(card.imageId);
          // Approximate resolution hint only; exact per-breakpoint values come from computeGridMetrics.
          const sizes =
            "(min-width: 1920px) calc((100vw - 126px) / 8 - 6px), (min-width: 1600px) calc((100vw - 102px) / 7 - 6px), (min-width: 1280px) calc((100vw - 75px) / 6 - 6px), (min-width: 1024px) calc((100vw - 56px) / 5 - 6px), (min-width: 768px) calc((100vw - 39px) / 4 - 6px), (min-width: 640px) calc((100vw - 30px) / 3 - 6px), calc((100vw - 10px) / 2 - 6px)";
          const fetchPriority = i === 0 ? "high" : undefined;
          return (
            // Must mirror <CardRowContent>'s cell shape (wrapper padding, image, label spacer)
            // or the static cells render a different size and the grid shifts when it goes live.
            <div
              key={sideKey(card)}
              className={cn("rounded-lg", BUTTON_PAD_CLASS, visibilityForIndex(i))}
            >
              {card.rotated ? (
                // aspect-card spacer gives the box a definite height so the rotated
                // overlay's top: 50% resolves in Firefox (see card-thumbnail.tsx).
                <div className="relative w-full overflow-hidden rounded-lg">
                  <div className="aspect-card" />
                  <div
                    className="absolute top-1/2 left-1/2 overflow-hidden"
                    style={LANDSCAPE_ROTATION_STYLE}
                  >
                    <ImgWithFallback
                      fallback={null}
                      src={imageUrl(card.imageId, "400w")}
                      srcSet={srcSet}
                      sizes={sizes}
                      width={880}
                      height={630}
                      alt={card.cardName}
                      fetchPriority={fetchPriority}
                      className="size-full object-cover"
                    />
                  </div>
                </div>
              ) : (
                <ImgWithFallback
                  fallback={
                    <div
                      role="img"
                      aria-label={card.cardName}
                      className="aspect-card bg-muted w-full rounded-lg"
                    />
                  }
                  src={imageUrl(card.imageId, "400w")}
                  srcSet={srcSet}
                  sizes={sizes}
                  width={400}
                  height={558}
                  alt={card.cardName}
                  fetchPriority={fetchPriority}
                  className="aspect-card w-full rounded-lg object-cover"
                />
              )}
              <div aria-hidden="true" style={{ height: LABEL_HEIGHT }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
