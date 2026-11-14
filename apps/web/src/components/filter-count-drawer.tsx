import { SlidersHorizontalIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { m } from "@/paraglide/messages.js";

export function FilterCountDrawer({
  count,
  description,
  open: controlledOpen,
  onOpenChange,
  onOpenChangeComplete,
  children,
}: {
  count: number;
  description: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpenChangeComplete?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [openedOnce, setOpenedOnce] = useState(false);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  return (
    <Drawer
      showSwipeHandle
      open={open}
      onOpenChangeComplete={onOpenChangeComplete}
      onOpenChange={(next) => {
        if (next) {
          setOpenedOnce(true);
        }
        setUncontrolledOpen(next);
        onOpenChange?.(next);
      }}
    >
      <DrawerTrigger
        render={<Button variant="outline" size="icon" className="relative shrink-0" />}
        aria-label={m.cards_filters()}
      >
        <SlidersHorizontalIcon className="size-4" />
        {count > 0 && (
          <Badge variant="count" className="absolute -top-1 -right-1 min-w-4 tabular-nums">
            {count}
          </Badge>
        )}
      </DrawerTrigger>
      <DrawerContent
        className="pb-4 data-ending-style:duration-250"
        keepMounted={openedOnce || open}
      >
        <DrawerHeader className="sr-only">
          <DrawerTitle>{m.cards_filters()}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-4">
          {children}
        </div>
        <DrawerFooter>
          <DrawerClose render={<Button className="w-full" />}>{m.common_done()}</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
