import { AvatarGroup } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/user-avatar";
import type { TradeMarketSource } from "@/features/groups/lib/trade-market";

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
