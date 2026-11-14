import type { LucideIcon } from "lucide-react";
import { AlertTriangleIcon, CheckCircle2Icon, XCircleIcon } from "lucide-react";

import type { ImportBucket } from "@/features/collections/lib/import-summary";

export const IMPORT_BUCKET_ICONS: Record<ImportBucket, { icon: LucideIcon; className: string }> = {
  ready: { icon: CheckCircle2Icon, className: "text-success" },
  "to-verify": { icon: AlertTriangleIcon, className: "text-warning" },
  "need-attention": { icon: XCircleIcon, className: "text-destructive" },
};
