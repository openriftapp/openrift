import { enumLabel } from "@openrift/shared/enum-label";
import type { DeckDetailResponse } from "@openrift/shared/types/api/deck";
import type { DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import { LinkIcon, PlusIcon } from "lucide-react";

import {
  PageTopBar,
  PageTopBarActions,
  PageTopBarBack,
  PageTopBarButton,
  PageTopBarIconButton,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DeckEditorMenu } from "@/features/decks/components/deck-editor-menu";
import { DeckUndoControls } from "@/features/decks/components/deck-undo-controls";
import { LocalDeckBadge } from "@/features/decks/components/local-save-hint";
import type { DeckEditorDialog } from "@/features/decks/hooks/use-deck-editor-dialogs";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { useZoneOrder } from "@/hooks/use-enums";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useCommandPaletteStore } from "@/stores/command-palette-store";

interface DeckEditorTopBarProps {
  deckId: string;
  deck: DeckDetailResponse["deck"];
  cards: DeckBuilderCard[];
  isLocal: boolean;
  activeZone: DeckZone | null;
  zoneCount: number;
  requiredProgress: { progress: number; total: number };
  hasViolations: boolean;
  onToggleSidebar?: () => void;
  openDialog: (dialog: DeckEditorDialog) => void;
  workbench?: { modeControl: React.ReactNode; menuPrefix: React.ReactNode; viewing: boolean };
}

export function DeckEditorTopBar({
  deckId,
  deck,
  cards,
  isLocal,
  activeZone,
  zoneCount,
  requiredProgress,
  hasViolations,
  onToggleSidebar,
  openDialog,
  workbench,
}: DeckEditorTopBarProps) {
  const { zoneLabels } = useZoneOrder();
  const openQuickAdd = useCommandPaletteStore((state) => state.openQuickAdd);
  // While a zone browser fills the main area (the hero out of sight), the top
  // bar carries the completion figure shared with the hero and sidebar header.
  const inZoneView = activeZone !== null || workbench !== undefined;

  return (
    <PageTopBar>
      <div className={workbench ? undefined : "hidden md:block"}>
        <PageTopBarBack to="/decks" aria-label={m.decks_compare_back_to_decks()} />
      </div>
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <PageTopBarTitle onToggleSidebar={onToggleSidebar}>
          <span className={workbench ? "hidden" : "md:hidden"}>
            {activeZone ? (
              <>
                {enumLabel(zoneLabels, activeZone)}
                <span className="text-muted-foreground ml-1">({zoneCount})</span>
              </>
            ) : (
              m.decks_editor_zones_short()
            )}
          </span>
          <span className={workbench ? "truncate" : "hidden md:inline"}>{deck.name}</span>
        </PageTopBarTitle>
        {/* In editing mode the hero scrolls out of reach, so the bar
            carries the shared completion figure as a compact chip. */}
        {inZoneView &&
          deck.format !== WellKnown.deckFormat.FREEFORM &&
          !(
            workbench &&
            !hasViolations &&
            requiredProgress.progress === requiredProgress.total
          ) && (
            <span
              className={cn(
                "hidden shrink-0 text-xs tabular-nums md:inline",
                hasViolations
                  ? "text-destructive"
                  : requiredProgress.progress === requiredProgress.total
                    ? "text-success"
                    : "text-muted-foreground",
              )}
            >
              {requiredProgress.progress}/{requiredProgress.total}
            </span>
          )}
        {isLocal && <LocalDeckBadge className="hidden shrink-0 sm:inline-flex" />}
      </div>
      <PageTopBarActions>
        {workbench?.modeControl}
        {!workbench?.viewing && (
          <>
            {/* No tooltip on the phone icon: no hover to open one and no
                  Ctrl+K to advertise. */}
            <PageTopBarIconButton
              className={workbench ? "hidden" : "md:hidden"}
              aria-label={m.decks_editor_add_card_aria()}
              onClick={() => openQuickAdd("add")}
            >
              <PlusIcon className="size-4" />
            </PageTopBarIconButton>
            <Tooltip>
              <TooltipTrigger
                render={
                  <PageTopBarButton
                    className="hidden md:inline-flex"
                    aria-keyshortcuts="Control+K"
                    onClick={() => openQuickAdd("add")}
                  />
                }
              >
                <PlusIcon className="size-4" />
                {m.decks_editor_add_card()}
              </TooltipTrigger>
              <TooltipContent>{m.decks_editor_add_card_tooltip()}</TooltipContent>
            </Tooltip>
            <DeckUndoControls deckId={deckId} />
          </>
        )}
        {!isLocal && (
          <div className="hidden md:flex md:items-center md:gap-1">
            <PageTopBarButton onClick={() => openDialog("share")}>
              <LinkIcon className="size-4" />
              {m.decks_editor_share()}
            </PageTopBarButton>
          </div>
        )}
        <DeckEditorMenu
          deckId={deckId}
          deck={deck}
          cards={cards}
          isLocal={isLocal}
          openDialog={openDialog}
          prefix={workbench?.menuPrefix}
        />
      </PageTopBarActions>
    </PageTopBar>
  );
}
