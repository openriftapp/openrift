import { formatDay } from "@openrift/shared/format-date";
import type { TierListSummaryResponse } from "@openrift/shared/types/api/tier-list";
import { Link } from "@tanstack/react-router";
import { EllipsisVerticalIcon, LayersIcon, PlusIcon, Share2Icon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import {
  PageDescription,
  PageTopBar,
  PageTopBarActions,
  PageTopBarPrimaryButton,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TextLink } from "@/components/ui/text-link";
import { useCards } from "@/features/cards/hooks/use-cards";
import { CreateTierListDialog } from "@/features/stage/components/create-tier-list-dialog";
import { TierRowFrame } from "@/features/stage/components/tier-board";
import { TierCardTile } from "@/features/stage/components/tier-card-tile";
import { TierListShareDialog } from "@/features/stage/components/tier-list-share-dialog";
import { useDeleteTierList, useTierLists } from "@/features/stage/hooks/use-tier-lists";
import { resolveTierRows } from "@/features/stage/lib/tier-list-presentation";
import { cn, PAGE_PADDING, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const PREVIEW_TILE_WIDTH = 40;

function tierListSummary(tierList: TierListSummaryResponse): string {
  return m.tier_lists_row_summary({
    cards: tierList.cardCount,
    tiers: tierList.tierCount,
    date: formatDay(tierList.updatedAt),
  });
}

export function TierListIndexPage() {
  const { data: tierLists } = useTierLists();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarTitle>{m.tier_lists_page_title()}</PageTopBarTitle>
          <PageTopBarActions>
            <PageTopBarPrimaryButton onClick={() => setCreateOpen(true)}>
              <PlusIcon />
              {m.tier_lists_new()}
            </PageTopBarPrimaryButton>
          </PageTopBarActions>
        </PageTopBar>
      </PageTopBarSticky>

      <div className={cn(PAGE_WIDTH.capped, PAGE_PADDING, "flex flex-col gap-4 pt-3 pb-6")}>
        <PageDescription>{m.tier_lists_page_description()}</PageDescription>

        {tierLists.length === 0 ? (
          <EmptyState
            icon={LayersIcon}
            title={m.tier_lists_empty_title()}
            description={
              <>
                {m.tier_lists_empty_description()}{" "}
                <TextLink render={<Link to="/help/$slug" params={{ slug: "tier-lists" }} />}>
                  {m.tier_lists_empty_learn_more()}
                </TextLink>
              </>
            }
          >
            <Button onClick={() => setCreateOpen(true)}>
              <PlusIcon />
              {m.tier_lists_new()}
            </Button>
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-6">
            {tierLists.map((tierList) => (
              <TierListRow key={tierList.id} tierList={tierList} />
            ))}
          </div>
        )}
      </div>

      <CreateTierListDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

function TierListRow({ tierList }: { tierList: TierListSummaryResponse }) {
  const { cardsById, printingsByCardId } = useCards();
  const deleteTierList = useDeleteTierList();
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const resolved = resolveTierRows(tierList.previewRows, cardsById, printingsByCardId);
  const preview = tierList.previewRows.map((row, index) => ({
    ...row,
    cards: resolved[index]?.cards ?? [],
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="min-w-0">
          <TextLink
            variant="inherit"
            render={<Link to="/tier-lists/$tierListId" params={{ tierListId: tierList.id }} />}
          >
            {tierList.title}
          </TextLink>
        </CardTitle>
        <CardDescription>{tierListSummary(tierList)}</CardDescription>
        <CardAction className="flex items-center gap-2">
          {tierList.isPublic && tierList.shareToken && (
            <Badge variant="outline">{m.tier_lists_badge_shared()}</Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={m.tier_lists_row_options_aria({ name: tierList.title })}
                />
              }
            >
              <EllipsisVerticalIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShareOpen(true)}>
                <Share2Icon />
                {m.tier_lists_row_share()}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2Icon />
                {m.common_delete()}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>

      {preview.length > 0 && (
        <CardContent className="flex flex-col gap-1">
          {preview.map((row) => (
            <TierRowFrame
              key={row.rowIndex}
              rowIndex={row.rowIndex}
              unranked={row.unranked}
              label={row.label}
              tileWidth={PREVIEW_TILE_WIDTH}
              clip
              flat
            >
              {row.cards.map((view) => (
                <TierCardTile key={view.cardId} view={view} width={PREVIEW_TILE_WIDTH} />
              ))}
            </TierRowFrame>
          ))}
        </CardContent>
      )}

      <TierListShareDialog
        tierListId={tierList.id}
        title={tierList.title}
        isPublic={tierList.isPublic}
        shareToken={tierList.shareToken}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.tier_lists_delete_title()}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.tier_lists_delete_description({ name: tierList.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.tier_lists_delete_keep()}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteTierList.mutate(tierList.id);
              }}
              disabled={deleteTierList.isPending}
            >
              {m.common_delete()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
