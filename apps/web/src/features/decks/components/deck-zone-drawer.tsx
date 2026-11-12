import { enumLabel } from "@openrift/shared/enum-label";
import type { DeckZone } from "@openrift/shared/types/enums";
import { Undo2Icon, XIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useSidebar } from "@/components/ui/sidebar";
import {
  closeOverlayHistoryEntry,
  useOverlayHistoryEntry,
} from "@/features/cards/hooks/use-overlay-history-entry";
import { useDeckUndo } from "@/features/decks/components/deck-undo-controls";
import { DeckZonePanelHeader } from "@/features/decks/components/deck-zone-panel";
import { useZoneOrder } from "@/hooks/use-enums";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function DeckZoneDrawer({
  deckId,
  onOverviewClick,
  target,
  children,
}: {
  deckId: string;
  onOverviewClick?: () => void;
  target?: DeckZone;
  children: React.ReactNode;
}) {
  const { zoneLabels } = useZoneOrder();
  const { openMobile, setOpenMobile } = useSidebar();
  const workbench = target !== undefined;
  const { canUndo, undo } = useDeckUndo(deckId);
  const scrollRef = useRef<HTMLDivElement>(null);

  useOverlayHistoryEntry({
    active: workbench && openMobile,
    stateKey: "deckSheet",
    onPop: () => setOpenMobile(false),
  });

  useEffect(() => {
    if (!openMobile || target === undefined) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      scrollRef.current
        ?.querySelector(`[data-zone="${target}"]`)
        ?.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [openMobile, target]);

  const handleWorkbenchOpenChange = (open: boolean) => {
    if (open) {
      setOpenMobile(true);
      return;
    }
    closeOverlayHistoryEntry("deckSheet", () => setOpenMobile(false));
  };

  return (
    <Drawer
      showSwipeHandle
      open={openMobile}
      onOpenChange={workbench ? handleWorkbenchOpenChange : setOpenMobile}
    >
      <DrawerContent className={cn(workbench && "motion-reduce:transition-none")}>
        <DrawerTitle className="sr-only">{m.decks_editor_zones_heading()}</DrawerTitle>
        <div className="bg-popover flex shrink-0 items-center gap-2 border-b px-3 pt-1 pb-3">
          <div className="min-w-0 flex-1">
            <DeckZonePanelHeader deckId={deckId} onOverviewClick={onOverviewClick} />
          </div>
          <DrawerClose render={<Button variant="ghost" size="icon" className="shrink-0" />}>
            <XIcon />
            <span className="sr-only">{m.common_close()}</span>
          </DrawerClose>
        </div>
        {target !== undefined && (
          <div className="text-muted-foreground flex shrink-0 items-center gap-2 border-b px-3 py-2">
            <span className="min-w-0 flex-1">
              {m.decks_workbench_sheet_hint({ zone: enumLabel(zoneLabels, target) })}
            </span>
            <Button variant="ghost" size="sm" disabled={!canUndo} onClick={undo}>
              <Undo2Icon className="size-4" />
              {m.decks_editor_undo()}
            </Button>
          </div>
        )}
        <div
          ref={scrollRef}
          className="pb-safe min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-3"
        >
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
