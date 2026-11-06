import { createContext, use } from "react";
import type { MouseEventHandler, ReactElement, ReactNode } from "react";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";

const ResponsivePopoverMobileContext = createContext(false);

function ResponsivePopover({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();

  return (
    <ResponsivePopoverMobileContext value={isMobile}>
      {isMobile ? (
        <Drawer open={open} onOpenChange={(next) => onOpenChange(next)} showSwipeHandle>
          {children}
        </Drawer>
      ) : (
        <Popover open={open} onOpenChange={(next) => onOpenChange(next)}>
          {children}
        </Popover>
      )}
    </ResponsivePopoverMobileContext>
  );
}

function ResponsivePopoverTrigger({
  render,
  children,
}: {
  render: ReactElement;
  children?: ReactNode;
}) {
  const isMobile = use(ResponsivePopoverMobileContext);
  return isMobile ? (
    <DrawerTrigger render={render}>{children}</DrawerTrigger>
  ) : (
    <PopoverTrigger render={render}>{children}</PopoverTrigger>
  );
}

function ResponsivePopoverContent({
  title,
  description,
  hideTitle = false,
  align = "start",
  popoverClassName,
  drawerClassName,
  onClick,
  children,
}: {
  title: string;
  description?: ReactNode;
  hideTitle?: boolean;
  align?: "start" | "center" | "end";
  popoverClassName?: string;
  drawerClassName?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
  children: ReactNode;
}) {
  const isMobile = use(ResponsivePopoverMobileContext);
  if (isMobile) {
    // React bubbles clicks on the portaled backdrop and viewport to the trigger's ancestors too.
    return (
      // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- event boundary around the portal, renders no box
      <div className="contents" onClick={onClick}>
        <DrawerContent>
          <DrawerHeader className={cn(hideTitle && "sr-only")}>
            <DrawerTitle>{title}</DrawerTitle>
            {description !== undefined && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          <div
            data-slot="responsive-popover-body"
            className={cn(
              "flex min-h-0 flex-1 flex-col overflow-y-auto p-2 pb-4 **:data-[slot=command-list]:max-h-none **:data-[slot=picker-row]:min-h-(--control-h)",
              drawerClassName,
            )}
          >
            {children}
          </div>
        </DrawerContent>
      </div>
    );
  }
  return (
    <PopoverContent
      align={align}
      aria-label={title}
      className={cn("w-80 p-0", popoverClassName)}
      onClick={onClick}
    >
      {children}
    </PopoverContent>
  );
}

export { ResponsivePopover, ResponsivePopoverContent, ResponsivePopoverTrigger };
