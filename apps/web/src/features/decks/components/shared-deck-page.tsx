import { useNavigate, getRouteApi } from "@tanstack/react-router";
import { CopyIcon } from "lucide-react";

import { SignedOutAuthButtons } from "@/components/signed-out-cta";
import { Button } from "@/components/ui/button";
import { PublicDeckActionsMenu } from "@/features/decks/components/public-deck-actions-menu";
import { PublicDeckSurface } from "@/features/decks/components/public-deck-surface";
import { useCloneSharedDeck, usePublicDeck } from "@/features/decks/hooks/use-decks";
import { useSession } from "@/hooks/use-session";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

const routeApi = getRouteApi("/_app/decks_/share/$token");

export function SharedDeckPage() {
  const { token } = routeApi.useParams();
  const { data } = usePublicDeck(token);
  const { data: session } = useSession();
  const isLoggedIn = Boolean(session?.user);
  const cloneMutation = useCloneSharedDeck();
  const navigate = useNavigate();

  const handleClone = async () => {
    let cloned: Awaited<ReturnType<typeof cloneMutation.mutateAsync>> | undefined;
    const ok = await runReportedMutation(async () => {
      cloned = await cloneMutation.mutateAsync({ token });
    });
    if (ok && cloned) {
      void navigate({ to: "/decks/$deckId", params: { deckId: cloned.deckId } });
    }
  };

  return (
    <PublicDeckSurface
      data={data}
      isLoggedIn={isLoggedIn}
      heroByline={
        data.owner.displayName ? m.decks_share_byline({ name: data.owner.displayName }) : undefined
      }
      heroActions={
        <>
          {isLoggedIn ? (
            <Button onClick={() => void handleClone()} pending={cloneMutation.isPending}>
              <CopyIcon />
              {m.decks_share_copy_to_my_decks()}
            </Button>
          ) : (
            <SignedOutAuthButtons
              source="shared-deck"
              signInLabel={m.decks_share_sign_in_to_copy()}
            />
          )}
          <PublicDeckActionsMenu
            deckId={data.deck.id}
            deckName={data.deck.name}
            shareToken={token}
            linkKind="share"
            updatedAt={data.deck.updatedAt}
            cards={data.cards}
          />
        </>
      }
    />
  );
}
