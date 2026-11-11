import { XIcon } from "lucide-react";
import { Suspense, useRef } from "react";
import type { CSSProperties, KeyboardEventHandler, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { CardDetailSkeleton } from "@/features/cards/components/selection-detail-pane";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { PrintingsHostProvider, usePrintingsHostState } from "./printings-host";

interface CardDetailShellProps {
  open?: boolean;
  onClose: () => void;
  style?: CSSProperties;
  children: ReactNode;
  after?: ReactNode;
}

export function CardDetailDialogShell({
  open = true,
  onClose,
  style,
  onKeyDown,
  children,
  after,
}: CardDetailShellProps & { onKeyDown?: KeyboardEventHandler<HTMLDivElement> }) {
  const { expanded, host, slotRef } = usePrintingsHostState();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent
        className={cn(
          "top-[8dvh] max-h-[calc(100dvh-8dvh-1rem)] translate-y-0 transition-[top,max-width,max-height] duration-300 ease-out sm:max-w-[860px]",
          expanded &&
            "top-8 h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] overflow-hidden sm:max-w-[calc(100vw-4rem)]",
        )}
        style={style}
        onKeyDown={onKeyDown}
        showCloseButton={false}
      >
        <DialogClose
          render={<Button variant="ghost" className="absolute top-2 right-2" size="icon-sm" />}
          // Must match the pane and drawer close label: one locator finds all three.
          aria-label={m.card_detail_close()}
        >
          <XIcon className="size-4" />
        </DialogClose>
        <DialogHeader className="sr-only">
          <DialogTitle>{m.cards_detail_title()}</DialogTitle>
          <DialogDescription>{m.cards_detail_description()}</DialogDescription>
        </DialogHeader>
        <div inert={expanded} className="contents">
          <PrintingsHostProvider host={host}>
            <Suspense fallback={<CardDetailModalSkeleton />}>{children}</Suspense>
          </PrintingsHostProvider>
          {after}
        </div>
        <div
          ref={slotRef}
          className={cn("bg-popover absolute inset-0 z-40", !expanded && "hidden")}
        />
      </DialogContent>
    </Dialog>
  );
}

export function CardDetailDrawerShell({
  open = true,
  onClose,
  style,
  children,
  after,
}: CardDetailShellProps) {
  const detailRef = useRef<HTMLDivElement>(null);
  const { expanded, host, slotRef } = usePrintingsHostState({
    scrollerRef: detailRef,
    slides: true,
  });
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DrawerContent
        // Fixed height overrides the popup's auto sizing to fill the screen
        // minus the iOS safe area.
        className="data-[swipe-direction=down]:h-[calc(100dvh-env(safe-area-inset-top,0px))] data-[swipe-direction=down]:max-h-none"
        style={style}
      >
        <DrawerHeader className="sr-only">
          <DrawerTitle>{m.cards_detail_title()}</DrawerTitle>
          <DrawerDescription>{m.cards_detail_description()}</DrawerDescription>
        </DrawerHeader>
        {/* overflow-clip: focusing a tile scrolls an overflow-hidden ancestor, which would offset the slide. */}
        <div className="flex min-h-0 flex-1 overflow-clip">
          <div
            className={cn(
              "flex w-[200%] shrink-0 transition-transform duration-300 ease-out",
              expanded && "-translate-x-1/2",
            )}
          >
            <div
              ref={detailRef}
              inert={expanded}
              className="flex min-h-0 w-1/2 flex-col overflow-y-auto"
            >
              <PrintingsHostProvider host={host}>
                <Suspense fallback={<CardDetailSkeleton />}>{children}</Suspense>
              </PrintingsHostProvider>
            </div>
            <div ref={slotRef} inert={!expanded} className="flex min-h-0 w-1/2 flex-col" />
          </div>
        </div>
        {after}
      </DrawerContent>
    </Drawer>
  );
}

/**
 * Mirrors the two-column arrangement: a full-width `aspect-card` block inside
 * an 860px dialog would open the dialog ~1150px tall and then snap it down.
 */
function CardDetailModalSkeleton() {
  return (
    <div className="@container flex flex-col gap-4">
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid gap-5 @2xl:grid-cols-[340px_minmax(0,1fr)]">
        <Skeleton className="aspect-card w-full rounded-xl" />
        <div className="min-w-0 space-y-4">
          <div className="flex gap-1.5">
            <Skeleton className="h-7 w-16 rounded-md" />
            <Skeleton className="h-7 w-16 rounded-md" />
            <Skeleton className="h-7 w-16 rounded-md" />
          </div>
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
