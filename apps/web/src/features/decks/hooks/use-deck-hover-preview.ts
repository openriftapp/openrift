import { useRef, useState } from "react";

import { usePreferredPrinting } from "@/features/cards/hooks/use-preferred-printing";
import { frontImageId } from "@/features/cards/lib/card-meta";
import type { HoverOrigin } from "@/features/cards/lib/hover-dock";
import type { HoverPreviewImage } from "@/features/cards/lib/hover-preview";
import { hoverPreviewImage } from "@/features/cards/lib/hover-preview";

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
  hoveredCard: HoverPreviewImage | null;
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

  return {
    hoveredCard: printing ? hoverPreviewImage(frontImageId(printing), printing.card.types) : null,
    origin: hovered?.origin ?? "sidebar",
    containerRef,
    handleHoverSidebar: hoverFrom("sidebar"),
    handleHoverMain: hoverFrom(options.mainOrigin),
  };
}
