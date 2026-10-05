import { enumLabel } from "@openrift/shared/enum-label";

import { CardIcon } from "@/components/card-icon";
import { useEnumOrders } from "@/hooks/use-enums";
import { getFilterIconPath } from "@/lib/icons";
import { cn } from "@/lib/utils";

/** `labelled` names it for screen readers where no rarity text sits beside it. */
export function RarityIcon({
  rarity,
  size = "thumbnail",
  labelled = false,
  className,
}: {
  rarity: string;
  size?: "thumbnail" | "full";
  labelled?: boolean;
  className?: string;
}) {
  const { labels } = useEnumOrders();
  const src = getFilterIconPath("rarities", rarity, { size });
  if (!src) {
    return null;
  }
  return (
    <CardIcon
      src={src}
      alt={labelled ? enumLabel(labels.rarities, rarity) : undefined}
      className={cn("size-4 shrink-0", className)}
    />
  );
}
