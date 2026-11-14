import { Eyebrow } from "@/components/heading";
import { CardArtThumbStack } from "@/features/cards/components/card-art-thumb-stack";
import { cn } from "@/lib/utils";

const MAX_THUMBS = 5;

export interface ShelfThumb {
  key: string;
  imageId?: string | null;
  src?: string;
  alt?: string;
  landscape?: boolean;
}

export function TradeShelfRowView({
  label,
  tone,
  items,
  detail,
}: {
  label: string;
  tone: "warning" | "success";
  items: ShelfThumb[];
  detail: string;
}) {
  return (
    <li className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <Eyebrow
        as="span"
        className={cn(
          "text-xs sm:w-32 sm:shrink-0",
          tone === "warning" ? "text-warning" : "text-success",
        )}
      >
        {label}
      </Eyebrow>
      <div className="flex min-w-0 items-center gap-3">
        <CardArtThumbStack items={items} max={MAX_THUMBS} thumbClassName="w-8" />
        <span className="text-muted-foreground min-w-0 truncate text-sm">{detail}</span>
      </div>
    </li>
  );
}
