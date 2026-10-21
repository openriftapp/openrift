import { getRouteApi } from "@tanstack/react-router";

import { NewCardRecord } from "@/features/catalog-workspace/components/new-card-record";

const routeApi = getRouteApi("/_app/_authenticated/admin/workspace/cards/new/$name");

export function NewCardRecordPage() {
  const { name } = routeApi.useParams();
  return <NewCardRecord key={name} name={name} />;
}
