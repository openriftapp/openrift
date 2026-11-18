import type { MetaDeckCardsQuery } from "@openrift/shared/types/api/meta";

import { Button } from "@/components/ui/button";
import { useMetaOverlayFailure } from "@/features/meta/hooks/use-meta-overlay-failure";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

/** Renders nothing unless a query behind the deck values, bans or owned marks failed. */
export function MetaOverlayNote({
  decks,
  enabled,
  withPrices,
  className,
}: {
  decks: MetaDeckCardsQuery | undefined;
  enabled: boolean;
  withPrices: boolean;
  className?: string;
}) {
  const { failed, retry } = useMetaOverlayFailure(decks, { enabled, withPrices });
  if (!failed) {
    return null;
  }
  return (
    <p role="status" className={cn("text-muted-foreground text-sm", className)}>
      {m.meta_overlays_failed()}{" "}
      <Button variant="link" size="sm" className="h-auto p-0" onClick={retry}>
        {m.common_retry()}
      </Button>
    </p>
  );
}
