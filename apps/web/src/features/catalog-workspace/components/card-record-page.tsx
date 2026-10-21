import { getRouteApi } from "@tanstack/react-router";

import { CardRecord } from "@/features/catalog-workspace/components/card-record";

const routeApi = getRouteApi("/_app/_authenticated/admin/workspace/cards/$cardSlug");

export function CardRecordPage() {
  const { cardSlug } = routeApi.useParams();
  return <CardRecord key={cardSlug} cardSlug={cardSlug} />;
}
