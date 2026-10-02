import { imageUrl } from "@openrift/shared/image-url";
import type { PointerEvent, ReactNode } from "react";
import { useRef, useState } from "react";

import { ImageHoverPreview } from "@/features/cards/components/printing-hover-preview";

interface HoveredCard {
  imageId: string;
  landscape: boolean;
}

export function useRuleCardPreview(): {
  handlePointerOver: (event: PointerEvent<HTMLElement>) => void;
  handlePointerOut: (event: PointerEvent<HTMLElement>) => void;
  preview: ReactNode;
} {
  const anchorRef = useRef<HTMLElement | null>(null);
  const [hovered, setHovered] = useState<HoveredCard | null>(null);

  const handlePointerOver = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse" || !(event.target instanceof Element)) {
      return;
    }
    const anchor = event.target.closest<HTMLElement>("a[data-card-image]");
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

  const preview = hovered ? (
    <ImageHoverPreview
      thumbnailUrl={imageUrl(hovered.imageId, "400w")}
      fullUrl={imageUrl(hovered.imageId, "full")}
      landscape={hovered.landscape}
      anchorRef={anchorRef}
    />
  ) : null;

  return { handlePointerOver, handlePointerOut, preview };
}
