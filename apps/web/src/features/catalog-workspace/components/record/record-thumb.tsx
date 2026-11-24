import { useQuery } from "@tanstack/react-query";

import { AdminCardThumb } from "@/features/admin/components/admin-card-thumb";
import { cardImagesQueryOptions } from "@/features/catalog-workspace/lib/workspace-queries";

export function CardThumb({ cardSlug }: { cardSlug: string | null }) {
  const { data: images } = useQuery(cardImagesQueryOptions());
  const image = cardSlug === null ? undefined : images?.[cardSlug];
  return (
    <AdminCardThumb url={image?.url ?? null} cardType={image?.cardType ?? null} className="w-7" />
  );
}
