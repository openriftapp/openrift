import { Menu } from "@base-ui/react/menu";
import { enumLabel } from "@openrift/shared/enum-label";
import type { Printing } from "@openrift/shared/types/catalog";
import type { ComponentType, MouseEvent, ReactNode } from "react";
import { createContext, useState } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { MenuSectionParts } from "@/features/cards/components/printing-choice-menu";
import {
  CONTEXT_MENU_PARTS,
  PrintingChoiceMenuSection,
  PrintingChoicePreview,
  usePrintingChoiceHover,
} from "@/features/cards/components/printing-choice-menu";
import { usePrintingChoices } from "@/features/cards/hooks/use-printing-choices";
import { useDeckBuilderActions, useDeckCards } from "@/features/decks/hooks/use-deck-builder";
import { useDeckDetail } from "@/features/decks/hooks/use-decks";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { buildMoveRows, getAllowedMoveTargets } from "@/features/decks/lib/deck-builder-card";
import { useWorkbenchStore } from "@/features/decks/stores/workbench-store";
import { useZoneOrder } from "@/hooks/use-enums";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { m } from "@/paraglide/messages.js";

interface DeckCardPrintingMenuProps {
  deckId: string;
  card: DeckBuilderCard;
  children: ReactNode;
  onViewCard?: () => void;
  onSwitch?: () => void;
  onOpenPlan?: () => void;
}

const POPUP_CLASS = "max-h-[70vh] w-72 overflow-y-auto";

interface RowMenuParts extends MenuSectionParts {
  Separator: ComponentType;
}

const ROW_CONTEXT_MENU_PARTS: RowMenuParts = {
  ...CONTEXT_MENU_PARTS,
  Separator: ContextMenuSeparator,
};

const ROW_DROPDOWN_PARTS: RowMenuParts = {
  Group: DropdownMenuGroup,
  Label: DropdownMenuLabel,
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
};

function SplitHint({ children }: { children: ReactNode }) {
  return (
    <span className="text-muted-foreground/70 ml-1 hidden normal-case md:inline">{children}</span>
  );
}

/** Read by the row's "⋮" button, which opens the same items as the right-click menu. */
export const DeckRowMenuContext = createContext<Menu.Handle<unknown> | null>(null);

/** On mobile (no drag, no shift key) a multi-copy row gets an extra "move 1" entry per zone. */
export function DeckCardPrintingMenu({
  deckId,
  card,
  children,
  onViewCard,
  onSwitch,
  onOpenPlan,
}: DeckCardPrintingMenuProps) {
  const { zoneLabels } = useZoneOrder();
  const { changePreferredPrinting, moveCard, moveOneCard, setQuantity } =
    useDeckBuilderActions(deckId);
  const workbench = useWorkbenchStore((state) => state.relaxed);
  const isMobile = useIsMobile();
  const printings = usePrintingChoices(card.cardId, card.preferredPrintingId);
  const { hoveredId, popupRef, hoverProps, reset } = usePrintingChoiceHover();
  // oxlint-disable-next-line react/hook-use-state -- a stable per-mount handle, never replaced
  const [menuHandle] = useState(() => Menu.createHandle());

  const { data: deckDetail } = useDeckDetail(deckId);
  const deckCards = useDeckCards(deckId);
  const moveTargets = getAllowedMoveTargets(card, deckDetail.deck.format, deckCards);
  const explicitSplit = isMobile || workbench;
  const splitRowsShown = explicitSplit && card.quantity > 1;
  const moveRows = buildMoveRows(moveTargets, card.quantity, explicitSplit);

  if (printings.length === 0 && moveTargets.length === 0 && !workbench && !onOpenPlan) {
    return children;
  }

  const countFor = (event: MouseEvent) => (event.shiftKey && card.quantity > 1 ? 1 : card.quantity);

  const handleSelect = (printing: Printing, event: MouseEvent) => {
    changePreferredPrinting(
      card.cardId,
      card.zone,
      card.preferredPrintingId,
      printing.printingId,
      countFor(event),
    );
  };

  /** `null` clears the pinned printing so the row falls back to the language/set default. */
  const handleSelectDefault = (event: MouseEvent) => {
    changePreferredPrinting(
      card.cardId,
      card.zone,
      card.preferredPrintingId,
      null,
      countFor(event),
    );
  };

  const handleMove = (targetZone: (typeof moveTargets)[number], splitOne: boolean) => {
    if (splitOne) {
      moveOneCard(card.cardId, card.zone, targetZone, card.preferredPrintingId);
    } else {
      moveCard(card.cardId, card.zone, targetZone, card.preferredPrintingId);
    }
  };

  const renderItems = (parts: RowMenuParts) => {
    const { Group, Label, Item, Separator: MenuSeparator } = parts;
    return (
      <>
        {(onViewCard || onSwitch || onOpenPlan) && (
          <>
            {onViewCard && <Item onClick={onViewCard}>{m.decks_card_menu_view_details()}</Item>}
            {onSwitch && (
              <Item onClick={onSwitch}>
                {m.decks_card_menu_switch({ zone: enumLabel(zoneLabels, card.zone) })}
              </Item>
            )}
            {onOpenPlan && (
              <Item onClick={onOpenPlan}>{m.decks_card_menu_plan_battlefields()}</Item>
            )}
            <MenuSeparator />
          </>
        )}
        {moveTargets.length > 0 && (
          <>
            <Group className="flex flex-col gap-0.5">
              <Label>
                {m.decks_card_menu_move_to()}
                {card.quantity > 1 && !explicitSplit && (
                  <SplitHint>{m.decks_card_menu_shift_move_hint()}</SplitHint>
                )}
              </Label>
              {moveRows.map((row) => (
                <Item
                  key={`${row.zone}:${row.splitOne}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleMove(row.zone, row.splitOne || (event.shiftKey && card.quantity > 1));
                  }}
                >
                  {enumLabel(zoneLabels, row.zone)}
                  {splitRowsShown && (
                    <span className="text-muted-foreground/70 ml-1">
                      {row.splitOne
                        ? m.decks_card_menu_move_one()
                        : m.decks_card_menu_move_all({ count: card.quantity })}
                    </span>
                  )}
                </Item>
              ))}
            </Group>
            {printings.length > 0 && <MenuSeparator />}
          </>
        )}
        <PrintingChoiceMenuSection
          printings={printings}
          activePrintingId={card.preferredPrintingId}
          hoverProps={hoverProps}
          hint={card.quantity > 1 && <SplitHint>{m.decks_card_menu_shift_split_hint()}</SplitHint>}
          onSelect={handleSelect}
          onSelectDefault={handleSelectDefault}
          parts={parts}
        />
        {workbench && (
          <>
            <MenuSeparator />
            <Item
              variant="destructive"
              onClick={(event) => {
                event.stopPropagation();
                setQuantity(card.cardId, card.zone, 0, card.preferredPrintingId);
              }}
            >
              {m.decks_workbench_remove_all({ count: card.quantity })}
            </Item>
          </>
        )}
      </>
    );
  };

  return (
    <DeckRowMenuContext value={menuHandle}>
      <ContextMenu onOpenChange={(open) => !open && reset()}>
        <ContextMenuTrigger render={<div />}>{children}</ContextMenuTrigger>
        <ContextMenuContent ref={popupRef} className={POPUP_CLASS}>
          {renderItems(ROW_CONTEXT_MENU_PARTS)}
        </ContextMenuContent>
      </ContextMenu>
      <DropdownMenu handle={menuHandle} onOpenChange={(open) => !open && reset()}>
        <DropdownMenuContent ref={popupRef} align="end" className={POPUP_CLASS}>
          {renderItems(ROW_DROPDOWN_PARTS)}
        </DropdownMenuContent>
      </DropdownMenu>
      <PrintingChoicePreview hoveredId={hoveredId} printings={printings} anchorRef={popupRef} />
    </DeckRowMenuContext>
  );
}
