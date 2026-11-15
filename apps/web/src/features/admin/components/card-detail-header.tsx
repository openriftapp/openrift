import type { AdminCardResponse } from "@openrift/shared/types/api/admin";
import { Link } from "@tanstack/react-router";
import {
  CheckCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import {
  PageTopBarBack,
  PageTopBarButton,
  PageTopBarIconButton,
  PageTopBarPrimaryButton,
} from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
import { cardListSearch } from "@/features/admin/hooks/use-card-review-navigation";
import type { CardReviewNavSearch } from "@/features/admin/hooks/use-card-review-navigation";
import type { PrevNextSlugs } from "@/features/admin/lib/admin-card-nav";

interface CardDetailHeaderProps {
  card: AdminCardResponse;
  cardSlug: string;
  expectedCardSlug: string;
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
  cardSlug,
  expectedCardSlug,
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
  const isCardSlugStale = cardSlug !== expectedCardSlug;
  const [deleteOpen, setDeleteOpen] = useState(false);

  const checkAllLabel = (
    <>
      <CheckCheckIcon />
      <span className="hidden sm:inline">Check all & next</span>
      <Kbd className="bg-background/20 pointer-events-none ml-1 leading-none text-inherit opacity-60 max-sm:hidden">
        Ctrl ⇧ ↵
      </Kbd>
    </>
  );

  return (
    <>
      <AdminPageTopBar
        title={canonicalName}
        back={
          listSearch.status === "review" ? (
            <PageTopBarBack to="/admin/review" aria-label="Back to review" />
          ) : (
            <PageTopBarBack
              to="/admin/cards"
              search={cardListSearch(listSearch)}
              aria-label="Back to cards"
            />
          )
        }
        actions={
          <>
            {isCardSlugStale && (
              <Badge
                variant="warning"
                title={`ID → ${expectedCardSlug}`}
                className="max-w-20 shrink sm:max-w-48"
              >
                <span className="truncate">ID &rarr; {expectedCardSlug}</span>
              </Badge>
            )}
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
            <Link
              to="/cards/$cardSlug/{-$printingSlug}"
              params={{ cardSlug }}
              aria-label="View public page"
              className={buttonVariants({ variant: "ghost" })}
            >
              <EyeIcon />
              <span className="hidden sm:inline">View public page</span>
            </Link>
            {isAdmin &&
              (hasUnchecked ? (
                <PageTopBarPrimaryButton
                  className="gap-1.5"
                  aria-label="Check all & next"
                  pending={isCheckingAll}
                  onClick={onCheckAllAndNext}
                >
                  {checkAllLabel}
                </PageTopBarPrimaryButton>
              ) : (
                <PageTopBarButton
                  className="gap-1.5"
                  aria-label="Check all & next"
                  pending={isCheckingAll}
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
                  {isCardSlugStale && (
                    <DropdownMenuItem
                      disabled={renameCard.isPending}
                      onClick={() =>
                        renameCard.mutate(
                          { cardId: card.id, cardSlug, newId: expectedCardSlug },
                          { onSuccess: () => goToCard(expectedCardSlug) },
                        )
                      }
                    >
                      <RefreshCwIcon className="mr-2" />
                      Regenerate ID ({expectedCardSlug})
                    </DropdownMenuItem>
                  )}
                  {isCardSlugStale && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={deleteCardMutation.isPending}
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2Icon className="mr-2" />
                    Delete card
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />
      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete card "${canonicalName}"?`}
        description="This deletes the card and all its printings. This cannot be undone."
        confirmLabel="Delete card"
        isPending={deleteCardMutation.isPending}
        onConfirm={() =>
          deleteCardMutation.mutate(card.id, {
            onSuccess: () => {
              setDeleteOpen(false);
              goToList();
            },
          })
        }
      />
    </>
  );
}
