import { ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function ImageCreditLine({ credit, className }: { credit: string; className?: string }) {
  return (
    <p className={cn("text-muted-foreground flex items-center gap-1 text-xs", className)}>
      <ImageIcon className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate">{m.card_detail_image_credit({ credit })}</span>
    </p>
  );
}
