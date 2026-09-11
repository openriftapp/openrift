import type { AdminCardResponse } from "@openrift/shared/types/api/admin";
import { Link } from "@tanstack/react-router";
import {
  CheckCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisVerticalIcon,
  LoaderIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";

import {
  PageTopBarBack,
  PageTopBarButton,
  PageTopBarIconButton,
  PageTopBarPrimaryButton,
} from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { useDeleteCard, useRenameCard } from "@/features/admin/hooks/use-admin-card-mutations";
import type { CardReviewNavSearch } from "@/features/admin/hooks/use-card-review-navigation";
import type { PrevNextSlugs } from "@/features/admin/lib/admin-card-nav";

interface CardDetailHeaderProps {
  card: AdminCardResponse;
  cardId: string;
  expectedCardId: string;
  hasUnchecked: boolean;
  prevNextCards: PrevNextSlugs;
  listSearch: CardReviewNavSearch;
  isCheckingAll: boolean;
  onCheckAllAndNext: () => void;
  goToCard: (cardSlug: string) => void;
  goToList: () => void;
  isAdmin: boolean;
}

export function CardDetailHeader({
  card,
  cardId,
  expectedCardId,
  hasUnchecked,
  prevNextCards,
  listSearch,
  isCheckingAll,
  onCheckAllAndNext,
  goToCard,
  goToList,
  isAdmin,
}: CardDetailHeaderProps) {
  const renameCard = useRenameCard();
  const deleteCardMutation = useDeleteCard();
  const canonicalName = card.name;
  const isCardIdStale = cardId !== expectedCardId;

  const checkAllLabel = (
    <>
      {isCheckingAll ? <LoaderIcon className="animate-spin" /> : <CheckCheckIcon />}
      {isCheckingAll ? "Checking…" : "Check all & next"}
      <Kbd className="bg-background/20 pointer-events-none ml-1 leading-none text-inherit opacity-60">
        Ctrl ⇧ ↵
      </Kbd>
    </>
  );

  return (
    <AdminPageTopBar
      title={canonicalName}
      back={<PageTopBarBack to="/admin/cards" search={listSearch} aria-label="Back to cards" />}
      actions={
        <>
          {isCardIdStale && <Badge variant="warning">ID &rarr; {expectedCardId}</Badge>}
          <PageTopBarIconButton
            aria-label="Previous card"
            disabled={!prevNextCards.prev}
            onClick={() => {
              if (prevNextCards.prev) {
                goToCard(prevNextCards.prev);
              }
            }}
          >
            <ChevronLeftIcon />
          </PageTopBarIconButton>
          <PageTopBarIconButton
            aria-label="Next card"
            disabled={!prevNextCards.next}
            onClick={() => {
              if (prevNextCards.next) {
                goToCard(prevNextCards.next);
              }
            }}
          >
            <ChevronRightIcon />
          </PageTopBarIconButton>
          <PageTopBarButton
            render={<Link to="/cards/$cardSlug/{-$printingSlug}" params={{ cardSlug: cardId }} />}
          >
            View public page
          </PageTopBarButton>
          {isAdmin &&
            (hasUnchecked ? (
              <PageTopBarPrimaryButton
                className="gap-1.5"
                disabled={isCheckingAll}
                onClick={onCheckAllAndNext}
              >
                {checkAllLabel}
              </PageTopBarPrimaryButton>
            ) : (
              <PageTopBarButton
                className="gap-1.5"
                disabled={isCheckingAll}
                onClick={onCheckAllAndNext}
              >
                {checkAllLabel}
              </PageTopBarButton>
            ))}
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<PageTopBarIconButton aria-label="Card actions" />}>
                <EllipsisVerticalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isCardIdStale && (
                  <DropdownMenuItem
                    disabled={renameCard.isPending}
                    onClick={() =>
                      renameCard.mutate(
                        { cardId: card.id, newId: expectedCardId },
                        { onSuccess: () => goToCard(expectedCardId) },
                      )
                    }
                  >
                    <RefreshCwIcon className="mr-2" />
                    Regenerate ID ({expectedCardId})
                  </DropdownMenuItem>
                )}
                {isCardIdStale && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  disabled={deleteCardMutation.isPending}
                  onClick={() => {
                    if (
                      globalThis.confirm(
                        `Delete card "${canonicalName}" and all its printings? This cannot be undone.`,
                      )
                    ) {
                      deleteCardMutation.mutate(card.id, { onSuccess: goToList });
                    }
                  }}
                >
                  <Trash2Icon className="text-destructive mr-2" />
                  <span className="text-destructive">Delete card</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </>
      }
    />
  );
}
