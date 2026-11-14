import { legendDisplayName } from "@openrift/shared/card-name";
import { getOrientation } from "@openrift/shared/card-orientation";
import { imageUrl } from "@openrift/shared/image-url";
import type { Printing } from "@openrift/shared/types/catalog";
import { useState } from "react";

import { LANDSCAPE_ROTATION_STYLE, needsCssRotation } from "@/lib/images";
import { cn } from "@/lib/utils";

/** Landscape cards (battlefields) are rotated in CSS, which needs the extra clipping wrapper. */
function QuickAddPreview({
  printing,
  src,
  className,
  onError,
}: {
  printing: Printing;
  src: string;
  className?: string;
  onError: () => void;
}) {
  const rotated = needsCssRotation(getOrientation(printing.card.types));
  const alt = legendDisplayName(printing.card);
  return (
    <div className={cn("bg-muted aspect-card rounded-card relative overflow-hidden", className)}>
      {rotated ? (
        <div className="absolute top-1/2 left-1/2 overflow-hidden" style={LANDSCAPE_ROTATION_STYLE}>
          <img src={src} alt={alt} className="size-full object-cover" onError={onError} />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className="absolute inset-0 w-full object-cover"
          onError={onError}
        />
      )}
    </div>
  );
}

export function QuickAddPreviews({
  printing,
  isMobile,
}: {
  printing: Printing | null | undefined;
  isMobile: boolean;
}) {
  // Keyed by image id, not a boolean, so previewing another printing retries fresh.
  const [failedImageId, setFailedImageId] = useState<string | null>(null);
  const rawImageId = printing?.images[0]?.imageId ?? null;
  const imageId = rawImageId === failedImageId ? null : rawImageId;
  const markFailed = () => setFailedImageId(rawImageId);

  return printing && imageId ? (
    <>
      {/* Renders at a fixed 160px; 400w covers it at DPR 2. */}
      {isMobile && (
        <div className="mb-3 flex justify-center">
          <QuickAddPreview
            printing={printing}
            src={imageUrl(imageId, "400w")}
            className="w-40"
            onError={markFailed}
          />
        </div>
      )}
      <div className="absolute top-0 right-full mr-3 hidden w-96 lg:block">
        <QuickAddPreview printing={printing} src={imageUrl(imageId, "full")} onError={markFailed} />
      </div>
    </>
  ) : null;
}
