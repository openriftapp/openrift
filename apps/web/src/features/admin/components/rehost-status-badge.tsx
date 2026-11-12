import type { AdminPrintingImageResponse } from "@openrift/shared/types/api/admin";
import { TriangleAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { rehostStatus, rehostStatusTitle } from "@/features/admin/lib/rehost-status";

const LABELS = {
  pending: "Pending rehost",
  failed: "Rehost failed",
  "not-rehosted": "Not rehosted",
} as const;

export function RehostStatusBadge({
  image,
}: {
  image: Pick<AdminPrintingImageResponse, "rehostedUrl" | "activateWhenRehosted" | "rehostFailure">;
}) {
  const status = rehostStatus(image);
  if (status === "rehosted") {
    return null;
  }
  return (
    <Badge
      variant={status === "pending" ? "warning" : "destructive"}
      title={rehostStatusTitle(image)}
    >
      {status === "pending" ? null : <TriangleAlertIcon />}
      {LABELS[status]}
    </Badge>
  );
}
