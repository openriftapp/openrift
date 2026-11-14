import { getOrientation } from "@openrift/shared/card-orientation";
import { imageUrl } from "@openrift/shared/image-url";
import type { CardType } from "@openrift/shared/types/enums";

export interface HoverPreviewImage {
  thumbnailUrl: string;
  fullUrl: string;
  landscape: boolean;
}

export function hoverPreviewImage(
  imageId: string | null | undefined,
  cardTypes: readonly CardType[],
): HoverPreviewImage | null {
  if (!imageId) {
    return null;
  }
  return {
    thumbnailUrl: imageUrl(imageId, "400w"),
    fullUrl: imageUrl(imageId, "full"),
    landscape: getOrientation(cardTypes) === "landscape",
  };
}
