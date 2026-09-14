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
import { legendDisplayName } from "@openrift/shared/utils";
import { getRouteApi, Outlet } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { DndScrollWatcher } from "@/components/dnd-scroll-watcher";
import { Footer } from "@/components/layout/footer";
import {
  PAGE_TOP_BAR_STICKY_BASE,
  PageTopBarHeightContext,
  useMeasuredHeight,
} from "@/components/layout/page-top-bar";
import { TopBarSlotContext } from "@/components/layout/top-bar-slot";
import { SidebarProvider } from "@/components/ui/sidebar";
import { CardDragGhost } from "@/features/cards/components/card-drag-ghost";
import { FilterSearchProvider } from "@/features/cards/lib/search-schemas";
import { useGridSelectionStore } from "@/features/cards/stores/grid-selection-store";
import {
  resolveDropCopyIds,
  resolveSelectionDrag,
} from "@/features/collections/components/collection-drag";
import { CollectionSidebar } from "@/features/collections/components/collection-sidebar";
import type {
  AnyDragData,
  CardDragData,
  ListEntryDragData,
} from "@/features/collections/components/dnd-types";
import { COLLECTION_DRAG_TYPES } from "@/features/collections/components/dnd-types";
import { useMoveCopies } from "@/features/collections/hooks/use-copies";
import { useDragPreviewStore } from "@/features/collections/stores/drag-preview-store";
import type { SidebarListDropData } from "@/features/lists/components/droppable-sidebar-list";
import type { PendingEntryMove } from "@/features/lists/components/move-entry-dialog";
import { MoveEntryDialog } from "@/features/lists/components/move-entry-dialog";
import {
  useBulkAddCopiesToList,
  useBulkAddListEntries,
  useMoveListEntries,
} from "@/features/lists/hooks/use-lists";
import type { MoveMode, MoveResolution } from "@/features/lists/lib/list-move";
import { moveNeedsDialog, ruleEntryCopyInputs } from "@/features/lists/lib/list-move";
import { describeListAdd } from "@/features/lists/lib/list-toast";
import { ViewSurfaceProvider } from "@/hooks/use-view-prefs";
import { asDragData } from "@/lib/dnd-data";
import { isTypingTarget } from "@/lib/keyboard-target";
import { parseMoveDigit } from "@/lib/parse-digit-key";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const routeApi = getRouteApi("/_app/_authenticated/collections");

const DRAG_ACTIVATION = { distance: 8 };
const MODIFIERS = [snapCenterToCursor];

type CollectionDropData = { type: "collection"; collectionId: string } | SidebarListDropData;

const COLLECTION_DROP_TYPES = [
  "collection",
  "list",
] as const satisfies readonly CollectionDropData["type"][];

export function CollectionLayout() {
  const search = routeApi.useSearch();
  const [topBarSlot, setTopBarSlot] = useState<HTMLDivElement | null>(null);
  const topBarHeight = useMeasuredHeight(topBarSlot);
  const [activeDrag, setActiveDrag] = useState<AnyDragData | null>(null);
  // null → one copy, "all" → Shift held, number → digit key 2-9 held. Only
  // meaningful for `collection-card` drags; list-entry drags carry the whole entry.
  const [moveModifier, setMoveModifier] = useState<"all" | number | null>(null);
  const [pendingMove, setPendingMove] = useState<
    (PendingEntryMove & { drag: ListEntryDragData }) | null
  >(null);
  // Ctrl while dropping a list entry copies it instead of moving it.
  const [copyModifier, setCopyModifier] = useState(false);
  // Read by the key listener below, which is mounted once and can't see
  // `activeDrag` without re-subscribing on every drag.
  const dragActiveRef = useRef(false);
  const moveCopies = useMoveCopies();
  const bulkAddCopiesToList = useBulkAddCopiesToList();
  const bulkAddListEntries = useBulkAddListEntries();
  const moveListEntries = useMoveListEntries();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: DRAG_ACTIVATION }));

  // Tracked for the whole layout so Shift held before grabbing a card isn't missed.
  // Digits only arm the modifier while dragActiveRef is set: unarmed, the same keys add copies (useGridKeyboardNav).
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }
      if (event.key === "Shift") {
        setMoveModifier("all");
        return;
      }
      if (event.key === "Control") {
        setCopyModifier(true);
        return;
      }
      const digit = parseMoveDigit(event.key);
      if (digit !== null && dragActiveRef.current) {
        setMoveModifier(digit);
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        setMoveModifier((current) => (current === "all" ? null : current));
        return;
      }
      if (event.key === "Control") {
        setCopyModifier(false);
        return;
      }
      const digit = parseMoveDigit(event.key);
      if (digit !== null) {
        setMoveModifier((current) => (current === digit ? null : current));
      }
    };
    // Clear on blur: if the user alt-tabs while holding a key, the keyup
    // arrives in another window and we never see it.
    const handleBlur = () => setMoveModifier(null);
    globalThis.addEventListener("keydown", handleKeyDown);
    globalThis.addEventListener("keyup", handleKeyUp);
    globalThis.addEventListener("blur", handleBlur);
    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
      globalThis.removeEventListener("keyup", handleKeyUp);
      globalThis.removeEventListener("blur", handleBlur);
    };
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    dragActiveRef.current = true;
    const data = asDragData<AnyDragData>(event.active.data.current, COLLECTION_DRAG_TYPES);
    if (data?.type === "collection-card") {
      setActiveDrag(resolveSelectionDrag(data));
      return;
    }
    if (data?.type === "list-entry") {
      setActiveDrag(data);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const modifier = moveModifier;
    const dragData = asDragData<AnyDragData>(event.active.data.current, COLLECTION_DRAG_TYPES);
    const mode: MoveMode =
      copyModifier || (dragData?.type === "list-entry" && dragData.ruleEntry) ? "copy" : "move";
    dragActiveRef.current = false;
    setActiveDrag(null);

    const dropData = asDragData<CollectionDropData>(
      event.over?.data.current,
      COLLECTION_DROP_TYPES,
    );

    if (!dropData || !dragData) {
      return;
    }

    if (dragData.type === "collection-card") {
      handleCollectionCardDrop(resolveSelectionDrag(dragData), dropData, modifier);
      return;
    }

    if (dragData.type !== "list-entry") {
      return;
    }
    if (dropData.type === "list") {
      handleListEntryDrop(dragData, dropData, mode);
      return;
    }
    if (dragData.copyIds.length > 0) {
      const count = dragData.copyIds.length;
      moveCopies.mutate(
        { copyIds: dragData.copyIds, toCollectionId: dropData.collectionId },
        { onSuccess: () => toast.success(m.collections_toast_moved({ count })) },
      );
    }
  };

  function handleCollectionCardDrop(
    dragData: CardDragData,
    dropData: { type: "collection"; collectionId: string } | SidebarListDropData,
    modifier: "all" | number | null,
  ) {
    if (dropData.type === "collection") {
      if (dragData.sourceCollectionId === dropData.collectionId) {
        return;
      }
      const copyIds = resolveDropCopyIds(dragData, modifier);
      const count = copyIds.length;
      moveCopies.mutate(
        { copyIds, toCollectionId: dropData.collectionId },
        {
          onSuccess: () => {
            toast.success(m.collections_toast_moved({ count }));
            if (dragData.fromSelection) {
              useGridSelectionStore.getState().clearSelection();
            }
          },
        },
      );
      return;
    }

    // Group-shared copies can't go on trade/wish lists; the server would
    // silently skip every one and report nothing added.
    if (dropData.listIntent !== "organize" && dragData.sourceAllGroupCopies) {
      toast.info(m.collections_toast_shared_group_not_allowed());
      return;
    }

    // The trim (one/n/whole stack) only shows up on copy-kind lists; the server
    // derives the entry shape from the list's kind and dedupes.
    bulkAddCopiesToList.mutate(
      { listId: dropData.listId, copyIds: resolveDropCopyIds(dragData, modifier) },
      {
        onSuccess: (result) => {
          const listName = dropData.listName;
          toast[result.added + result.updated === 0 ? "info" : "success"](
            describeListAdd(result, listName),
          );
          if (dragData.fromSelection) {
            useGridSelectionStore.getState().clearSelection();
          }
        },
      },
    );
  }

  function movedToListMessage(kind: string, count: number, list: string): string {
    if (kind === "copy") {
      return m.collections_toast_moved_to_list_copies({ count, list });
    }
    if (kind === "printing") {
      return m.collections_toast_moved_to_list_printings({ count, list });
    }
    return m.collections_toast_moved_to_list_cards({ count, list });
  }

  function runListEntryMove(
    dragData: ListEntryDragData,
    dropData: SidebarListDropData,
    mode: MoveMode,
    resolution: MoveResolution | null,
  ) {
    if (dragData.ruleEntry) {
      const subject = { ...dragData, ruleEntry: dragData.ruleEntry };
      bulkAddListEntries.mutate(
        {
          listId: dropData.listId,
          entries: ruleEntryCopyInputs(subject, dropData.listKind, resolution),
        },
        {
          onSuccess: (result) => {
            setPendingMove(null);
            toast.success(
              m.lists_toast_copied_to_list({
                count: result.added + result.updated,
                list: dropData.listName,
              }),
            );
          },
        },
      );
      return;
    }
    moveListEntries.mutate(
      {
        fromListId: dragData.sourceListId,
        toListId: dropData.listId,
        entryIds: dragData.entryIds,
        mode,
        resolutions: resolution
          ? dragData.entryIds.map((entryId) => ({ entryId, ...resolution }))
          : undefined,
      },
      {
        onSuccess: (result) => {
          setPendingMove(null);
          if (result.moved === 0) {
            return;
          }
          toast.success(
            mode === "copy"
              ? m.lists_toast_copied_to_list({ count: result.moved, list: dropData.listName })
              : movedToListMessage(dropData.listKind, result.moved, dropData.listName),
          );
        },
      },
    );
  }

  function handleListEntryDrop(
    dragData: ListEntryDragData,
    dropData: SidebarListDropData,
    mode: MoveMode,
  ) {
    if (dropData.listId === dragData.sourceListId) {
      return;
    }
    if (
      moveNeedsDialog(
        { kind: dragData.sourceKind, intent: dragData.sourceIntent },
        { kind: dropData.listKind, intent: dropData.listIntent },
      )
    ) {
      setPendingMove({ mode, subject: dragData, target: dropData, drag: dragData });
      return;
    }
    runListEntryMove(dragData, dropData, mode, null);
  }

  return (
    <ViewSurfaceProvider value="collections">
      <FilterSearchProvider value={search}>
        <PageTopBarHeightContext value={topBarHeight}>
          <div className="flex min-h-0 flex-1 flex-col">
            <SidebarProvider className="flex-1">
              <DndContext
                sensors={sensors}
                collisionDetection={pointerWithin}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={() => {
                  dragActiveRef.current = false;
                  setActiveDrag(null);
                }}
              >
                <DndScrollWatcher />
                <TopBarSlotContext value={topBarSlot}>
                  <CollectionSidebar />
                  <CollectionContent setTopBarSlot={setTopBarSlot} />
                </TopBarSlotContext>
                <DragOverlay dropAnimation={null} modifiers={MODIFIERS}>
                  {activeDrag?.type === "collection-card" && (
                    <DragPreview drag={activeDrag} modifier={moveModifier} />
                  )}
                  {activeDrag?.type === "list-entry" && (
                    <ListEntryDragPreview
                      drag={activeDrag}
                      copy={copyModifier || activeDrag.ruleEntry !== undefined}
                    />
                  )}
                </DragOverlay>
              </DndContext>
            </SidebarProvider>
            <MoveEntryDialog
              pending={pendingMove}
              onOpenChange={(open) => {
                if (!open) {
                  setPendingMove(null);
                }
              }}
              onConfirm={(resolution) =>
                pendingMove &&
                runListEntryMove(
                  pendingMove.drag,
                  { type: "list", ...pendingMove.target },
                  pendingMove.mode,
                  resolution,
                )
              }
              isPending={moveListEntries.isPending || bulkAddListEntries.isPending}
            />
          </div>
        </PageTopBarHeightContext>
      </FilterSearchProvider>
    </ViewSurfaceProvider>
  );
}

function CollectionContent({
  setTopBarSlot,
}: {
  setTopBarSlot: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div className="pr-safe pl-gutter flex min-w-0 flex-1 flex-col pb-3">
      {/* No px-safe here: the column already clears iOS safe areas, and px-safe
          would double-inset the bar on notched phones in landscape. */}
      <div
        ref={setTopBarSlot}
        className={cn(PAGE_TOP_BAR_STICKY_BASE, "mr-safe-neg pr-safe ml-gutter-neg pl-gutter")}
      />
      <div className="flex flex-1 flex-col pb-3">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
}

function ListEntryDragPreview({ drag, copy }: { drag: ListEntryDragData; copy: boolean }) {
  const name = legendDisplayName(drag.printing.card);
  return (
    <CardDragGhost
      printings={[drag.printing]}
      label={copy ? m.collections_drag_copy_label({ name }) : name}
      count={drag.totalQuantity}
    />
  );
}

function pluralNoun(noun: string, count: number): string {
  if (noun === "copy") {
    return m.collections_drag_copies_plural({ count });
  }
  if (noun === "printing") {
    return m.collections_drag_printings_plural({ count });
  }
  return m.collections_drag_cards_plural({ count });
}

function DragPreview({ drag, modifier }: { drag: CardDragData; modifier: "all" | number | null }) {
  const printings = drag.previewPrintings.length > 0 ? drag.previewPrintings : [drag.printing];
  const selectionCount = useDragPreviewStore((s) => s.selectionCount);
  const selectionNoun = useDragPreviewStore((s) => s.selectionNoun);

  let count: number;
  let label: string;
  if (drag.fromSelection && selectionCount >= 1) {
    count = selectionCount;
    label =
      selectionCount === 1
        ? legendDisplayName(drag.printing.card)
        : pluralNoun(selectionNoun, selectionCount);
  } else {
    // Counted through the same helper the drop uses, so the badge can't
    // promise a number the drop won't deliver.
    count = resolveDropCopyIds(drag, modifier).length;
    label = count === 1 ? legendDisplayName(drag.printing.card) : pluralNoun("copy", count);
  }
  return <CardDragGhost printings={printings} label={label} count={count} />;
}
