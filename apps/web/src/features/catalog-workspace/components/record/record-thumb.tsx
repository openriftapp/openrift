import { useQuery } from "@tanstack/react-query";

import { deskImageSrc } from "@/features/admin/lib/printing-desk-image";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import { cardImagesQueryOptions } from "@/features/catalog-workspace/lib/workspace-queries";

export function RecordThumb({ url }: { url: string | null }) {
  return (
    <CardArtThumb
      src={deskImageSrc(url, "240w")}
      alt=""
      loading="lazy"
      className="w-7 min-w-0 shrink-0"
    />
  );
}

export function CardThumb({ cardSlug }: { cardSlug: string | null }) {
  const { data: images } = useQuery(cardImagesQueryOptions());
  return <RecordThumb url={cardSlug === null ? null : (images?.[cardSlug] ?? null)} />;
}
