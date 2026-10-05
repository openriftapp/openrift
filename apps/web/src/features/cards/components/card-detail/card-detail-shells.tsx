import { XIcon } from "lucide-react";
import { Suspense } from "react";
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
import { m } from "@/paraglide/messages.js";

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
        className="sm:max-w-[860px]"
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
        <Suspense fallback={<CardDetailModalSkeleton />}>{children}</Suspense>
        {after}
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
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <Suspense fallback={<CardDetailSkeleton />}>{children}</Suspense>
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
