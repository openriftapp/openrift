import { createLazyFileRoute } from "@tanstack/react-router";

import { FaceRecordPage } from "@/features/catalog-workspace/components/face-record-page";

export const Route = createLazyFileRoute(
  "/_app/_authenticated/admin/workspace/faces/$cardSlug/$faceId",
)({
  component: FaceRecordPage,
});
