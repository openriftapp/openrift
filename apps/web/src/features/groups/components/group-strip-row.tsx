import { CardArtThumbStack } from "@/features/cards/components/card-art-thumb-stack";
import type { ShelfThumb } from "@/features/groups/components/trade-shelf-row";

const MAX_THUMBS = 5;

export function GroupStripRow({
  items,
  count,
  label,
}: {
  items: ShelfThumb[];
  count: number;
  label: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <CardArtThumbStack items={items} max={MAX_THUMBS} thumbClassName="w-8" />
      <span className="text-muted-foreground min-w-0 truncate text-sm">
        <span className="text-foreground font-medium">{count}</span> {label}
      </span>
    </div>
  );
}
