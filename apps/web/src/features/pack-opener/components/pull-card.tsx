import { legendDisplayName } from "@openrift/shared/card-name";
import { getOrientation } from "@openrift/shared/card-orientation";
import { imageUrl } from "@openrift/shared/image-url";
import type { PackPull } from "@openrift/shared/pack-opener/types";
import type { CatalogPrintingResponse } from "@openrift/shared/types/api/catalog";
import { WellKnown } from "@openrift/shared/well-known";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { FoilOverlay } from "@/features/cards/components/foil-overlay";
import { packSlotLabel } from "@/features/pack-opener/lib/pack-pull-labels";
import { useEnumOrders } from "@/hooks/use-enums";
import { LANDSCAPE_ROTATION_STYLE, needsCssRotation } from "@/lib/images";
import { cn } from "@/lib/utils";

const SLOT_BORDER: Record<PackPull["slot"], string> = {
  common: "ring-border",
  uncommon: "ring-border",
  token: "ring-border",
  flex: "ring-border",
  foil: "ring-info/60",
  showcase: "ring-border-accent/70",
  ultimate: "ring-violet/80",
};

const SLOT_GLOW: Record<PackPull["slot"], string> = {
  common: "",
  uncommon: "",
  token: "",
  flex: "",
  foil: "",
  showcase: "shadow-[0_0_28px_-6px_rgba(245,158,11,0.55)]",
  ultimate: "shadow-[0_0_36px_-4px_rgba(217,70,239,0.75)]",
};

interface PullCardProps {
  pull: PackPull;
  image: CatalogPrintingResponse["images"][number] | undefined;
  className?: string;
  shimmer?: boolean;
}

export function PullCard({ pull, image, className, shimmer = true }: PullCardProps) {
  const { printing } = pull;
  const { labels } = useEnumOrders();
  const highlight = SLOT_BORDER[pull.slot];
  const glow = SLOT_GLOW[pull.slot];
  // Always shows the holo effect on foil-finish pulls, ignoring the user's global foil preference.
  const showFoil = printing.finish === WellKnown.finish.FOIL;
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
      search={{ printingId: printing.id }}
      className={cn("group block", className)}
    >
      <div
        className={cn(
          "aspect-card relative overflow-hidden rounded-lg bg-neutral-800 ring-1",
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
              <img
                src={imageUrl(shownImage.imageId, "240w")}
                srcSet={`${imageUrl(shownImage.imageId, "240w")} 240w, ${imageUrl(shownImage.imageId, "400w")} 400w`}
                sizes="(max-width: 640px) 40vw, 160px"
                alt={displayName}
                loading="lazy"
                className="size-full object-cover"
                onError={() => setFailedImageId(shownImage.imageId)}
              />
            </div>
          ) : (
            <img
              src={imageUrl(shownImage.imageId, "240w")}
              srcSet={`${imageUrl(shownImage.imageId, "240w")} 240w, ${imageUrl(shownImage.imageId, "400w")} 400w`}
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
          <span>{printing.shortCode}</span>
          <span>{packSlotLabel(pull, labels.rarities)}</span>
        </div>
      </div>
    </Link>
  );
}
