import type { Printing } from "@openrift/shared/types/catalog";
import { legendDisplayName } from "@openrift/shared/utils";
import type { ReactNode } from "react";

import { AvatarGroup } from "@/components/ui/avatar";
import { Pressable } from "@/components/ui/pressable";
import { UserAvatar } from "@/components/user-avatar";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import { frontImageId } from "@/features/cards/lib/card-meta";
import type { TradeMarketSource } from "@/features/groups/lib/trade-market";
import { cn } from "@/lib/utils";

const MAX_AVATARS = 3;

export function SourceAvatars({ sources }: { sources: readonly TradeMarketSource[] }) {
  return (
    <AvatarGroup>
      {sources.slice(0, MAX_AVATARS).map((source) => (
        <UserAvatar
          key={source.userId}
          image={source.image}
          name={source.name}
          gravatarHash={source.gravatarHash}
          size="sm"
        />
      ))}
    </AvatarGroup>
  );
}

export function TradeMarketTile({
  printing,
  price,
  badge,
  footer,
  selected,
  onSelect,
}: {
  printing: Printing;
  price: string | null;
  badge?: ReactNode;
  footer: ReactNode;
  selected: boolean;
  onSelect: () => void;
}) {
  const name = legendDisplayName(printing.card);
  return (
    <Pressable
      aria-haspopup="dialog"
      onClick={onSelect}
      className="group/tile flex min-w-0 flex-col gap-2 rounded-lg"
    >
      <span
        className={cn(
          "ring-offset-background relative block min-w-0 rounded-lg ring-offset-2 transition-shadow",
          selected
            ? "ring-primary ring-2"
            : "group-hover/tile:ring-primary/40 group-hover/tile:ring-2",
        )}
      >
        <CardArtThumb
          imageId={frontImageId(printing)}
          alt={name}
          loading="lazy"
          rarity={printing.rarity}
          domains={printing.card.domains}
          className="w-full rounded-lg"
        />
        {price === null ? null : (
          <span className="bg-background/85 text-foreground absolute top-1.5 right-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums">
            {price}
          </span>
        )}
        {badge === undefined ? null : <span className="absolute bottom-1.5 left-1.5">{badge}</span>}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="truncate font-medium">{name}</span>
        {footer}
      </span>
    </Pressable>
  );
}
