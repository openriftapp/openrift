import type { ReactNode } from "react";

import { UserAvatar } from "@/components/user-avatar";
import { RegionBadge } from "@/features/tournaments/components/region-badge";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function PlayerChip({
  name,
  image,
  gravatarHash,
  region,
  dropped = false,
  children,
  className,
}: {
  name: string;
  image?: string | null;
  gravatarHash?: string | null;
  region?: string | null;
  dropped?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <UserAvatar
        name={name}
        image={image}
        gravatarHash={gravatarHash}
        size="sm"
        className="shrink-0"
      />
      <span className="truncate font-medium">{name}</span>
      {region ? <RegionBadge region={region} /> : null}
      {dropped ? (
        <span className="text-muted-foreground shrink-0 text-sm">
          {m.tournaments_standings_dropped()}
        </span>
      ) : null}
      {children}
    </div>
  );
}
