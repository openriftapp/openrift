import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PublicDeckActionsMenu } from "@/features/decks/components/public-deck-actions-menu";
import { PublicDeckSurface } from "@/features/decks/components/public-deck-surface";
import { useCloneSharedDeck, usePublicDeck } from "@/features/decks/hooks/use-decks";
import { useSession } from "@/lib/auth-session";
import { m } from "@/paraglide/messages.js";

export const Route = createLazyFileRoute("/_app/decks_/share/$token")({
  component: SharedDeckPage,
});

function SharedDeckPage() {
  const { token } = Route.useParams();
  const { data } = usePublicDeck(token);
  const { data: session } = useSession();
  const isLoggedIn = Boolean(session?.user);
  const cloneMutation = useCloneSharedDeck();
  const navigate = useNavigate();

  const handleClone = async () => {
    if (!isLoggedIn) {
      void navigate({
        to: "/login",
        search: { redirect: `/decks/share/${token}`, email: undefined },
      });
      return;
    }
    try {
      const result = await cloneMutation.mutateAsync(token);
      void navigate({ to: "/decks/$deckId", params: { deckId: result.deckId } });
    } catch {
      /* Reported by the global mutation error toast. */
    }
  };

  return (
    <PublicDeckSurface
      data={data}
      isLoggedIn={isLoggedIn}
      returnPath={`/decks/share/${token}`}
      heroByline={<>{m.decks_share_byline({ name: data.owner.displayName })}</>}
      heroActions={
        <>
          <Button onClick={() => void handleClone()} disabled={cloneMutation.isPending}>
            <CopyIcon />
            {cloneMutation.isPending
              ? m.decks_share_copying()
              : isLoggedIn
                ? m.decks_share_copy_to_my_decks()
                : m.decks_share_sign_in_to_copy()}
          </Button>
          <PublicDeckActionsMenu
            deckId={data.deck.id}
            deckName={data.deck.name}
            shareToken={token}
            updatedAt={data.deck.updatedAt}
            cards={data.cards}
          />
        </>
      }
    />
  );
}
