import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useSidebar } from "@/components/ui/sidebar";
import { DeckZonePanelHeader } from "@/features/decks/components/deck-zone-panel";
import { m } from "@/paraglide/messages.js";

export function DeckZoneDrawer({
  deckId,
  onOverviewClick,
  children,
}: {
  deckId: string;
  onOverviewClick?: () => void;
  children: React.ReactNode;
}) {
  const { openMobile, setOpenMobile } = useSidebar();

  return (
    <Drawer showSwipeHandle open={openMobile} onOpenChange={setOpenMobile}>
      <DrawerContent>
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
        <div className="pb-safe min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-3">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
