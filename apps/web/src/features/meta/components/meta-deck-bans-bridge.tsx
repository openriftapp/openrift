import type { MetaDeckCardsQuery } from "@openrift/shared/types/api/meta";
import { useEffect } from "react";

import { useMetaDeckBans } from "@/features/meta/hooks/use-meta-deck-bans";
import type { MetaBanGroup } from "@/features/meta/lib/meta-deck-bans";

/** Client-only: mount under `useHydrated` and a Suspense boundary. */
export function MetaDeckBansBridge({
  decks,
  onChange,
}: {
  decks?: MetaDeckCardsQuery;
  onChange: (value: ReadonlyMap<string, MetaBanGroup[]>) => void;
}) {
  const bans = useMetaDeckBans(decks);
  useEffect(() => {
    onChange(bans);
  }, [bans, onChange]);
  return null;
}
