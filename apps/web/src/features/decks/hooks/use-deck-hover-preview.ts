import { getOrientation } from "@openrift/shared/card-orientation";
import { imageUrl } from "@openrift/shared/image-url";
import { useRef, useState } from "react";

import { usePreferredPrinting } from "@/features/cards/hooks/use-preferred-printing";
import type { HoverOrigin } from "@/features/cards/lib/hover-dock";

interface HoveredCard {
  id: string;
  origin: HoverOrigin;
  preferredPrintingId: string | null;
}

type HoverHandler = (id: string | null, preferredPrintingId?: string | null) => void;

export function useDeckHoverPreview(options: {
  mainOrigin: HoverOrigin;
  disabled: boolean;
  suppressMain?: boolean;
}): {
  hoveredCard: { thumbnailUrl: string; fullUrl: string; landscape: boolean } | null;
  origin: HoverOrigin;
  containerRef: React.RefObject<HTMLDivElement | null>;
  handleHoverSidebar: HoverHandler;
  handleHoverMain: HoverHandler;
} {
  const { getPreferredPrinting } = usePreferredPrinting();
  const [hovered, setHovered] = useState<HoveredCard | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const hoverFrom =
    (origin: HoverOrigin): HoverHandler =>
    (id, preferredPrintingId) =>
      setHovered(id ? { id, origin, preferredPrintingId: preferredPrintingId ?? null } : null);

  const suppressed = options.suppressMain === true && hovered?.origin !== "sidebar";
  const printing =
    hovered && !options.disabled && !suppressed
      ? (getPreferredPrinting(hovered.id, hovered.preferredPrintingId) ?? null)
      : null;
  const front = printing?.images[0] ?? null;

  return {
    hoveredCard:
      printing && front
        ? {
            thumbnailUrl: imageUrl(front.imageId, "400w"),
            fullUrl: imageUrl(front.imageId, "full"),
            landscape: getOrientation(printing.card.types) === "landscape",
          }
        : null,
    origin: hovered?.origin ?? "sidebar",
    containerRef,
    handleHoverSidebar: hoverFrom("sidebar"),
    handleHoverMain: hoverFrom(options.mainOrigin),
  };
}
