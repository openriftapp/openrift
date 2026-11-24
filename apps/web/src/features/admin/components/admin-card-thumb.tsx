import { getOrientation } from "@openrift/shared/card-orientation";
import type { ImageVariant } from "@openrift/shared/image-url";
import type { CardType } from "@openrift/shared/types/enums";

import { deskImageSrc } from "@/features/admin/lib/printing-desk-image";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";

export function AdminCardThumb({
  url,
  cardType,
  rarity,
  alt = "",
  className,
  variant = "240w",
}: {
  url: string | null;
  cardType: string | null;
  rarity?: string | null;
  alt?: string;
  className?: string;
  variant?: ImageVariant;
}) {
  return (
    <CardArtThumb
      src={deskImageSrc(url, variant)}
      landscape={cardType !== null && getOrientation([cardType as CardType]) === "landscape"}
      rarity={rarity}
      alt={alt}
      loading="lazy"
      className={className}
    />
  );
}
