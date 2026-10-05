import { imageUrl } from "@openrift/shared/image-url";
import type { PointerEvent, ReactNode } from "react";
import { useRef, useState } from "react";

import { ImageHoverPreview } from "@/features/cards/components/printing-hover-preview";

interface HoveredCard {
  imageId: string;
  landscape: boolean;
}

interface CardHoverPreview {
  handlePointerOver: (event: PointerEvent<HTMLElement>) => void;
  handlePointerOut: (event: PointerEvent<HTMLElement>) => void;
  handlePointerDown: () => void;
  preview: ReactNode;
}

export function useRuleCardPreview(): CardHoverPreview {
  return useCardHoverPreview("a[data-card-image]");
}

/** Matches of `selector` carry `data-card-image` (an image id) and optionally `data-card-landscape`. */
export function useCardHoverPreview(selector: string): CardHoverPreview {
  const anchorRef = useRef<HTMLElement | null>(null);
  const [hovered, setHovered] = useState<HoveredCard | null>(null);

  const handlePointerOver = (event: PointerEvent<HTMLElement>) => {
    if (
      event.pointerType !== "mouse" ||
      event.buttons !== 0 ||
      !(event.target instanceof Element)
    ) {
      return;
    }
    const anchor = event.target.closest<HTMLElement>(selector);
    const imageId = anchor?.dataset.cardImage;
    if (!anchor || !imageId || anchor === anchorRef.current) {
      return;
    }
    anchorRef.current = anchor;
    setHovered({ imageId, landscape: anchor.dataset.cardLandscape !== undefined });
  };

  const handlePointerOut = (event: PointerEvent<HTMLElement>) => {
    const anchor = anchorRef.current;
    if (!anchor) {
      return;
    }
    const next = event.relatedTarget;
    if (next instanceof Node && anchor.contains(next)) {
      return;
    }
    anchorRef.current = null;
    setHovered(null);
  };

  const handlePointerDown = () => {
    anchorRef.current = null;
    setHovered(null);
  };

  const preview = hovered ? (
    <ImageHoverPreview
      thumbnailUrl={imageUrl(hovered.imageId, "400w")}
      fullUrl={imageUrl(hovered.imageId, "full")}
      landscape={hovered.landscape}
      anchorRef={anchorRef}
    />
  ) : null;

  return { handlePointerOver, handlePointerOut, handlePointerDown, preview };
}
