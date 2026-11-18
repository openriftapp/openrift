import { Button } from "@/components/ui/button";
import { useDeckOwnershipFailure } from "@/features/decks/hooks/use-deck-ownership-failure";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

/** Renders nothing unless the catalogue or prices behind a viewed deck's ownership failed. */
export function DeckOwnershipNote({
  enabled,
  className,
}: {
  enabled: boolean;
  className?: string;
}) {
  const { failed, retry } = useDeckOwnershipFailure(enabled);
  if (!failed) {
    return null;
  }
  return (
    <p role="status" className={cn("text-muted-foreground text-sm", className)}>
      {m.decks_ownership_failed()}{" "}
      <Button variant="link" size="sm" className="h-auto p-0" onClick={retry}>
        {m.common_retry()}
      </Button>
    </p>
  );
}
