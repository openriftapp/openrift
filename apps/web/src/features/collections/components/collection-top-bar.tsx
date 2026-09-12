import { Link } from "@tanstack/react-router";
import {
  BoxIcon,
  CameraIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  Share2Icon,
  SquarePlusIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";

import {
  PageTopBar,
  PageTopBarActions,
  PageTopBarButton,
  PageTopBarIconButton,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TextLink } from "@/components/ui/text-link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SelectModeActions } from "@/features/cards/components/select-mode-actions";
import { CollectionValueSummary } from "@/features/collections/components/collection-value-summary";
import { deckBoxLabel } from "@/features/decks/lib/deck-box-label";
import { m } from "@/paraglide/messages.js";

interface CollectionTopBarProps {
  title: string;
  homeDecks: { id: string; name: string }[];
  onToggleSidebar: () => void;
  mode: "browse" | "select";
  valueCents: number | null | undefined;
  unpricedCount: number | null | undefined;
  formatValue: (value: number) => string;
  addTarget?: string;
  showAddActions: boolean;
  onQuickAdd: () => void;
  onSelectAll: () => void;
  onEnterSelect: () => void;
  onExitSelect: () => void;
  hasCards: boolean;
  isAllSelected: boolean;
  view: string;
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
  canImport: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
  onImport: () => void;
  onExport: () => void;
}

export function CollectionTopBar({
  title,
  homeDecks,
  onToggleSidebar,
  mode,
  valueCents,
  unpricedCount,
  formatValue,
  addTarget,
  showAddActions,
  onQuickAdd,
  onSelectAll,
  onEnterSelect,
  onExitSelect,
  hasCards,
  isAllSelected,
  view,
  canEdit,
  canDelete,
  canShare,
  canImport,
  onEdit,
  onDelete,
  onShare,
  onImport,
  onExport,
}: CollectionTopBarProps) {
  const canAdd = Boolean(addTarget) && mode === "browse" && showAddActions;
  const shareInBar = canShare && mode === "browse";
  const boxLabel = deckBoxLabel(homeDecks);
  const singleHomeDeck = homeDecks.length === 1 ? homeDecks[0] : undefined;

  return (
    <PageTopBar>
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <PageTopBarTitle onToggleSidebar={onToggleSidebar}>{title}</PageTopBarTitle>

        {boxLabel && (
          <Badge variant="muted" className="shrink-0 gap-1">
            <BoxIcon className="size-3" />
            {singleHomeDeck ? (
              <TextLink
                variant="inherit"
                className="max-w-32 truncate"
                render={<Link to="/decks/$deckId" params={{ deckId: singleHomeDeck.id }} />}
              >
                {boxLabel}
              </TextLink>
            ) : (
              <span className="max-w-32 truncate">{boxLabel}</span>
            )}
          </Badge>
        )}

        <CollectionValueSummary
          valueCents={valueCents}
          unpricedCount={unpricedCount}
          formatValue={formatValue}
        />
      </div>

      <PageTopBarActions>
        <div className="flex items-center gap-2">
          {canAdd && (
            <>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <PageTopBarIconButton
                      render={<Link to="/scan" />}
                      aria-label={m.collections_topbar_scan_cards()}
                      className="sm:hidden"
                    />
                  }
                >
                  <CameraIcon className="size-4" />
                </TooltipTrigger>
                <TooltipContent>{m.collections_topbar_scan_cards()}</TooltipContent>
              </Tooltip>
              <PageTopBarButton render={<Link to="/scan" />} className="hidden sm:flex">
                <CameraIcon className="size-4" />
                {m.collections_topbar_scan()}
              </PageTopBarButton>
            </>
          )}
          {canAdd && (
            <>
              <PageTopBarIconButton
                onClick={onQuickAdd}
                aria-label={m.collections_topbar_quick_add()}
                className="sm:hidden"
              >
                <SquarePlusIcon className="size-4" />
              </PageTopBarIconButton>
              <PageTopBarButton onClick={onQuickAdd} className="hidden sm:flex">
                <SquarePlusIcon className="size-4" />
                {m.collections_topbar_quick_add()}
              </PageTopBarButton>
            </>
          )}
          <SelectModeActions
            mode={mode}
            view={view}
            isAllSelected={isAllSelected}
            hasSelectableItems={hasCards}
            onEnterSelect={onEnterSelect}
            onExitSelect={onExitSelect}
            onSelectAll={onSelectAll}
          />
          {shareInBar && (
            <>
              <PageTopBarIconButton
                onClick={onShare}
                aria-label={m.collections_topbar_share()}
                className="sm:hidden"
              >
                <Share2Icon className="size-4" />
              </PageTopBarIconButton>
              <PageTopBarButton onClick={onShare} className="hidden sm:flex">
                <Share2Icon className="size-4" />
                {m.collections_topbar_share()}
              </PageTopBarButton>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger render={<PageTopBarIconButton />}>
              <EllipsisVerticalIcon className="size-4" />
              <span className="sr-only">{m.collections_topbar_actions()}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem onClick={onEdit}>
                  <PencilIcon className="size-4" />
                  {m.collections_topbar_edit()}
                </DropdownMenuItem>
              )}
              {canImport && (
                <DropdownMenuItem onClick={onImport}>
                  <UploadIcon className="size-4" />
                  {m.collections_topbar_import()}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onExport}>
                <DownloadIcon className="size-4" />
                {m.collections_topbar_export()}
              </DropdownMenuItem>
              {canDelete && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2Icon className="size-4" />
                  {m.collections_topbar_delete()}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </PageTopBarActions>
    </PageTopBar>
  );
}
