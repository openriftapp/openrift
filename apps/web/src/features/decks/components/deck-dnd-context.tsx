import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import { legendDisplayName } from "@openrift/shared/card-name";
import { copyLimitFor } from "@openrift/shared/deck-rules";
import { isSingleSlotZone } from "@openrift/shared/deck-zones";
import type { DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { DndScrollWatcher } from "@/components/dnd-scroll-watcher";
import { CardDragGhost } from "@/features/cards/components/card-drag-ghost";
import { usePreferredPrinting } from "@/features/cards/hooks/use-preferred-printing";
import { useDeckBuilderActions, useDeckCards } from "@/features/decks/hooks/use-deck-builder";
import { isZoneDropRejected } from "@/features/decks/hooks/use-deck-zone-drop";
import { useDeckDetail } from "@/features/decks/hooks/use-decks";
import { copyLimitTotal, runeAddRoom } from "@/features/decks/lib/deck-builder-card";
import type { DeckDragData, DeckDropData } from "@/features/decks/lib/deck-dnd-data";
import {
  DECK_DRAG_TYPES,
  DECK_DROP_TYPES,
  isDropRejected,
  resolveDraggedCard,
} from "@/features/decks/lib/deck-dnd-data";
import { DECK_ZONE_ORDER } from "@/features/decks/lib/deck-zone-order";
import { showRelaxedAddToast } from "@/features/decks/lib/workbench-add-toast";
import { relaxedMoveOutcome, workbenchAddRoute } from "@/features/decks/lib/workbench-drop";
import { useWorkbenchStore } from "@/features/decks/stores/workbench-store";
import { useDragAutoScroll } from "@/hooks/use-drag-auto-scroll";
import { useShiftHeld } from "@/hooks/use-shift-held";
import { asDragData } from "@/lib/dnd-data";

const DRAG_ACTIVATION = { distance: 8 };
const MODIFIERS = [snapCenterToCursor];
/** The droppable zone container under a viewport point, read from the DOM. */
export function zoneAtPoint(
  point: { x: number; y: number } | null,
  doc: Document,
): DeckZone | null {
  if (point === null) {
    return null;
  }
  for (const element of doc.elementsFromPoint(point.x, point.y)) {
    const zone = element.closest<HTMLElement>("[data-deck-drop-zone]")?.dataset.deckDropZone;
    const known = DECK_ZONE_ORDER.find((candidate) => candidate === zone);
    if (known !== undefined) {
      return known;
    }
  }
  return null;
}

/** dnd-kit has no target for a release before it has measured the zones; the zone under the
 * pointer stands in. `null` means the card was dropped outside every zone. */
export function releaseDropTarget(
  over: DeckDropData | undefined,
  pointZone: DeckZone | null,
  isRejected: (zone: DeckZone) => boolean,
): DeckDropData | null {
  if (over?.type === "deck-zone") {
    return over;
  }
  if (pointZone === null) {
    return null;
  }
  return { type: "deck-zone", zone: pointZone, disabled: isRejected(pointZone) };
}

export function DeckDndContext({ deckId, children }: { deckId: string; children: ReactNode }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: DRAG_ACTIVATION }));
  const actions = useDeckBuilderActions(deckId);
  const deckCards = useDeckCards(deckId);
  const { data: deckDetail } = useDeckDetail(deckId);
  const format = deckDetail.deck.format;
  const relaxed = useWorkbenchStore((state) => state.relaxed);
  const [dragInfo, setDragInfo] = useState<{
    cardId: string;
    cardName: string;
    quantity: number;
    fromBrowser: boolean;
    maxCopiesOverride: number | null;
    keywords: readonly string[];
    preferredPrintingId: string | null;
  } | null>(null);
  const shiftHeld = useShiftHeld();
  const dragScroll = useDragAutoScroll();
  const releaseRef = useRef<{ x: number; y: number } | null>(null);

  // DragOverlay has pointer-events: none, so the cursor would otherwise reflect whatever is underneath.
  useEffect(() => {
    if (!dragInfo) {
      return;
    }
    document.body.style.cursor = "grabbing";
    return () => {
      document.body.style.cursor = "";
    };
  }, [dragInfo]);

  const handleDragStart = (event: DragStartEvent) => {
    dragScroll.start(event.activatorEvent);
    releaseRef.current = null;
    // Capture on the window runs before dnd-kit's document listener ends the drag.
    globalThis.addEventListener(
      "pointerup",
      (up: PointerEvent) => {
        releaseRef.current = { x: up.clientX, y: up.clientY };
      },
      { capture: true, once: true },
    );

    const data = asDragData<DeckDragData>(event.active.data.current, DECK_DRAG_TYPES);
    if (data?.type === "deck-card") {
      setDragInfo({
        cardId: data.cardId,
        cardName: data.cardName,
        quantity: data.quantity,
        fromBrowser: false,
        maxCopiesOverride: null,
        keywords: [],
        preferredPrintingId: data.preferredPrintingId,
      });
    } else if (data?.type === "browser-card") {
      setDragInfo({
        cardId: data.card.cardId,
        cardName: legendDisplayName({
          name: data.card.cardName,
          types: data.card.cardTypes,
          tags: data.card.tags,
        }),
        quantity: 1,
        fromBrowser: true,
        maxCopiesOverride: data.card.maxCopiesOverride,
        keywords: data.card.keywords,
        preferredPrintingId: data.card.preferredPrintingId,
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const moveAll = shiftHeld;
    setDragInfo(null);
    dragScroll.stop();

    const activeData = asDragData<DeckDragData>(event.active.data.current, DECK_DRAG_TYPES);

    if (!activeData) {
      return;
    }

    const overData = releaseDropTarget(
      asDragData<DeckDropData>(event.over?.data.current, DECK_DROP_TYPES),
      zoneAtPoint(releaseRef.current, document),
      (zone) =>
        isZoneDropRejected({ dragData: activeData, zone, allCards: deckCards, format, relaxed }),
    );

    if (overData === null) {
      if (activeData.type === "deck-card") {
        if (moveAll || activeData.quantity === 1) {
          actions.setQuantity(
            activeData.cardId,
            activeData.fromZone,
            0,
            activeData.preferredPrintingId,
          );
        } else {
          actions.removeCard(
            activeData.cardId,
            activeData.fromZone,
            activeData.preferredPrintingId,
          );
        }
      }
      return;
    }

    if (activeData.type === "browser-card") {
      if (isDropRejected(activeData, overData)) {
        return;
      }
      const route = relaxed
        ? workbenchAddRoute(activeData.card, overData.zone, deckCards, format)
        : "add";
      if (route === "replace") {
        useWorkbenchStore.getState().setReplaceTarget({
          cardId: activeData.card.cardId,
          preferredPrintingId: activeData.card.preferredPrintingId,
        });
        return;
      }
      if (route === "legend") {
        actions.setLegend(activeData.card);
        return;
      }
      if (moveAll) {
        if (overData.zone === WellKnown.deckZone.RUNES) {
          actions.addCard(activeData.card, overData.zone, runeAddRoom(activeData.card, deckCards));
        } else {
          // Unlimited-override cards have no cap, so a shift-drop adds a chunk of 3 (matching shift-click).
          const limit = copyLimitFor(activeData.card);
          actions.addCard(activeData.card, overData.zone, Number.isFinite(limit) ? limit : 3);
        }
      } else {
        actions.addCard(activeData.card, overData.zone);
      }
      return;
    }

    if (activeData.type === "deck-card") {
      if (isDropRejected(activeData, overData)) {
        return;
      }
      const { cardId, fromZone, preferredPrintingId } = activeData;
      const toZone = overData.zone;
      const moved =
        (moveAll || activeData.quantity === 1) && !isSingleSlotZone(toZone)
          ? activeData.quantity
          : 1;
      const source = relaxed ? resolveDraggedCard(activeData, deckCards) : undefined;
      const outcome = source
        ? relaxedMoveOutcome({ card: source, fromZone, toZone, moved, allCards: deckCards, format })
        : undefined;
      if (moveAll || activeData.quantity === 1) {
        actions.moveCard(
          activeData.cardId,
          activeData.fromZone,
          overData.zone,
          activeData.preferredPrintingId,
        );
      } else {
        actions.moveOneCard(
          activeData.cardId,
          activeData.fromZone,
          overData.zone,
          activeData.preferredPrintingId,
        );
      }
      if (outcome) {
        showRelaxedAddToast(outcome, {
          undo: () => {
            for (let step = 0; step < moved; step++) {
              actions.moveOneCard(cardId, toZone, fromZone, preferredPrintingId);
            }
          },
        });
      }
    }
  };

  const browserLimit = dragInfo?.fromBrowser ? copyLimitFor(dragInfo) : 3;
  const browserRemaining = dragInfo?.fromBrowser
    ? Number.isFinite(browserLimit)
      ? browserLimit - copyLimitTotal(deckCards, dragInfo.cardId)
      : 3
    : 0;

  const moveAll =
    shiftHeld &&
    dragInfo !== null &&
    (dragInfo.fromBrowser ? browserRemaining > 1 : dragInfo.quantity > 1);

  const { getPreferredPrinting } = usePreferredPrinting();
  const dragPrinting = dragInfo
    ? getPreferredPrinting(dragInfo.cardId, dragInfo.preferredPrintingId)
    : undefined;

  const dragCount = moveAll
    ? dragInfo?.fromBrowser
      ? browserRemaining
      : (dragInfo?.quantity ?? 1)
    : 1;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      autoScroll={dragScroll.autoScroll}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setDragInfo(null);
        dragScroll.stop();
      }}
    >
      <DndScrollWatcher />
      {children}
      <DragOverlay dropAnimation={null} modifiers={MODIFIERS}>
        {dragInfo && (
          <CardDragGhost
            printings={dragPrinting ? [dragPrinting] : []}
            card={dragPrinting?.card}
            label={dragInfo.cardName}
            count={dragCount}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
