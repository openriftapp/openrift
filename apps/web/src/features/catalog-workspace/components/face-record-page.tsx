import { getRouteApi } from "@tanstack/react-router";

import { FaceRecord } from "@/features/catalog-workspace/components/face-record";

const routeApi = getRouteApi("/_app/_authenticated/admin/workspace/faces/$cardSlug/$faceId");

export function FaceRecordPage() {
  const { cardSlug, faceId } = routeApi.useParams();
  return <FaceRecord key={faceId} cardSlug={cardSlug} faceId={faceId} />;
}
