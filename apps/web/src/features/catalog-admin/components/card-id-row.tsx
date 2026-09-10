import type { AdminCardResponse } from "@openrift/shared/types/api/admin";
import { useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useRenameCard } from "@/features/admin/hooks/use-admin-card-mutations";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { catalogAdminKeys } from "@/features/catalog-admin/lib/catalog-admin-query-keys";

const routeApi = getRouteApi("/_app/_authenticated/admin/catalog/cards/$cardSlug");

export function CardIdRow({
  card,
  expectedCardId,
}: {
  card: AdminCardResponse;
  expectedCardId: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = routeApi.useSearch();
  const renameCard = useRenameCard();
  const isStale = card.slug !== expectedCardId;

  // The rename hook keys its detail invalidation by card id; the detail query
  // is keyed by slug, so both slugs and the queue are cleared here.
  function clearRenamedCard() {
    for (const key of [
      adminKeys.cards.detail(card.slug),
      adminKeys.cards.detail(expectedCardId),
      catalogAdminKeys.reviewQueue,
    ]) {
      void queryClient.invalidateQueries({ queryKey: [...key] });
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>Card ID</Label>
      <div className="flex flex-wrap items-center gap-2">
        <span className={isStale ? "text-warning font-mono line-through" : "font-mono"}>
          {card.slug}
        </span>
        {isStale ? (
          <>
            <span className="font-mono">&rarr; {expectedCardId}</span>
            <Button
              variant="outline"
              disabled={renameCard.isPending}
              onClick={() =>
                renameCard.mutate(
                  { cardId: card.id, newId: expectedCardId },
                  {
                    onSuccess: () => {
                      clearRenamedCard();
                      void navigate({
                        to: "/admin/catalog/cards/$cardSlug",
                        params: { cardSlug: expectedCardId },
                        search,
                      });
                    },
                  },
                )
              }
            >
              <RefreshCwIcon />
              Regenerate
            </Button>
          </>
        ) : (
          <Badge variant="muted">Matches the name</Badge>
        )}
      </div>
    </div>
  );
}
