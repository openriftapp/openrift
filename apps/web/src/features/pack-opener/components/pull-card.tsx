import { legendDisplayName } from "@openrift/shared/card-name";
import { getOrientation } from "@openrift/shared/card-orientation";
import { imageSrcSet, imageUrl } from "@openrift/shared/image-url";
import type { CatalogPrintingResponse } from "@openrift/shared/types/api/catalog";
import { isFoilFinish } from "@openrift/shared/well-known";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { FoilOverlay } from "@/features/cards/components/foil-overlay";
import { PullVariantLine } from "@/features/pack-opener/components/pull-variant-line";
import { PREMIUM_OUTCOMES, packPullLabel } from "@/features/pack-opener/lib/pack-pull-labels";
import type { PackPull } from "@/features/pack-opener/lib/pack-types";
import { LANDSCAPE_ROTATION_STYLE, needsCssRotation } from "@/lib/images";
import { cn } from "@/lib/utils";

function pullHighlight(pull: PackPull): { ring: string; glow: string } {
  if (pull.outcome === "ultimate") {
    return { ring: "ring-violet/80", glow: "shadow-[0_0_36px_-4px_rgba(217,70,239,0.75)]" };
  }
  if (PREMIUM_OUTCOMES.has(pull.outcome)) {
    return { ring: "ring-border-accent/70", glow: "shadow-[0_0_28px_-6px_rgba(245,158,11,0.55)]" };
  }
  if (pull.slot === "foil") {
    return { ring: "ring-info/60", glow: "" };
  }
  return { ring: "ring-border", glow: "" };
}

interface PullCardProps {
  pull: PackPull;
  image: CatalogPrintingResponse["images"][number] | undefined;
  className?: string;
  shimmer?: boolean;
}

export function PullCard({ pull, image, className, shimmer = true }: PullCardProps) {
  const { printing } = pull;
  const { ring: highlight, glow } = pullHighlight(pull);
  // Always shows the holo effect on foil-finish pulls, ignoring the user's global foil preference.
  const showFoil = isFoilFinish(printing.finish);
  const rotated = needsCssRotation(getOrientation(printing.cardTypes));
  const displayName = legendDisplayName({
    name: printing.cardName,
    types: printing.cardTypes,
    tags: printing.tags,
  });
  // Keyed by image id so a changed image on a reused instance retries fresh.
  const [failedImageId, setFailedImageId] = useState<string | null>(null);
  const shownImage = image && image.imageId !== failedImageId ? image : undefined;

  return (
    <Link
      to="/cards/$cardSlug/{-$printingSlug}"
      params={{ cardSlug: printing.cardSlug }}
      search={{ printingId: printing.printingId }}
      className={cn("group block", className)}
    >
      <div
        className={cn(
          "aspect-card bg-card-blank relative overflow-hidden rounded-lg ring-1",
          highlight,
          glow,
          "transition-transform group-hover:-translate-y-0.5",
        )}
      >
        {shownImage ? (
          rotated ? (
            <div
              className="absolute top-1/2 left-1/2 overflow-hidden"
              style={LANDSCAPE_ROTATION_STYLE}
            >
              <ImgWithFallback
                fallback={null}
                src={imageUrl(shownImage.imageId, "240w")}
                srcSet={imageSrcSet(shownImage.imageId, ["240w", "400w"])}
                sizes="(max-width: 640px) 40vw, 160px"
                alt={displayName}
                loading="lazy"
                className="size-full object-cover"
                onError={() => setFailedImageId(shownImage.imageId)}
              />
            </div>
          ) : (
            <ImgWithFallback
              fallback={null}
              src={imageUrl(shownImage.imageId, "240w")}
              srcSet={imageSrcSet(shownImage.imageId, ["240w", "400w"])}
              sizes="(max-width: 640px) 40vw, 160px"
              alt={displayName}
              loading="lazy"
              className="absolute inset-0 size-full object-cover"
              onError={() => setFailedImageId(shownImage.imageId)}
            />
          )
        ) : (
          <div className="bg-muted absolute inset-0 flex items-center justify-center p-2 text-center text-xs">
            {displayName}
          </div>
        )}
        {showFoil && <FoilOverlay active shimmer={shimmer} />}
      </div>
      <div className="mt-1 px-0.5 text-xs">
        <div className="text-foreground truncate">{displayName}</div>
        <div className="text-muted-foreground flex items-center justify-between tabular-nums">
          <PullVariantLine printing={printing} className="min-w-0 flex-nowrap overflow-hidden" />
          <span>{packPullLabel(pull)}</span>
        </div>
      </div>
    </Link>
  );
}
