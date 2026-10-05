import { CardIcon } from "@/components/card-icon";
import type { FilterCategory } from "@/lib/icons";
import { getFilterIconPath } from "@/lib/icons";

export function FilterIcon({
  category,
  value,
  className,
}: {
  category: FilterCategory;
  value: string;
  className?: string;
}) {
  const src = getFilterIconPath(category, value);
  if (!src) {
    return null;
  }
  return <CardIcon src={src} className={className} />;
}
