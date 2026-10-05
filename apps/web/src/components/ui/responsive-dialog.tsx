import { createContext, use } from "react";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

// Hand-authored primitive (not shadcn-scaffolded). A bottom Drawer below md and
// a centered Dialog from md up; every part reads the branch from context.

const ResponsiveDialogMobileContext = createContext(false);

function ResponsiveDialog({
  open,
  onOpenChange,
  showSwipeHandle = true,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showSwipeHandle?: boolean;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();

  return (
    <ResponsiveDialogMobileContext value={isMobile}>
      {isMobile ? (
        <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle={showSwipeHandle}>
          {children}
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          {children}
        </Dialog>
      )}
    </ResponsiveDialogMobileContext>
  );
}

function ResponsiveDialogContent({
  className,
  drawerClassName,
  dialogClassName,
  showCloseButton,
  children,
}: {
  className?: string;
  drawerClassName?: string;
  dialogClassName?: string;
  showCloseButton?: boolean;
  children: ReactNode;
}) {
  const isMobile = use(ResponsiveDialogMobileContext);
  if (isMobile) {
    return (
      <DrawerContent>
        <div
          data-slot="responsive-dialog-body"
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4",
            drawerClassName ?? className,
          )}
        >
          {children}
        </div>
      </DrawerContent>
    );
  }
  return (
    <DialogContent className={dialogClassName ?? className} showCloseButton={showCloseButton}>
      {children}
    </DialogContent>
  );
}

function ResponsiveDialogHeader({ className, ...props }: ComponentProps<"div">) {
  const isMobile = use(ResponsiveDialogMobileContext);
  return isMobile ? (
    <DrawerHeader className={cn("p-0", className)} {...props} />
  ) : (
    <DialogHeader className={className} {...props} />
  );
}

function ResponsiveDialogFooter({ className, ...props }: ComponentProps<"div">) {
  const isMobile = use(ResponsiveDialogMobileContext);
  return isMobile ? (
    <DrawerFooter className={cn("flex-col-reverse p-0", className)} {...props} />
  ) : (
    <DialogFooter className={className} {...props} />
  );
}

function ResponsiveDialogTitle({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const isMobile = use(ResponsiveDialogMobileContext);
  return isMobile ? (
    <DrawerTitle className={className}>{children}</DrawerTitle>
  ) : (
    <DialogTitle className={className}>{children}</DialogTitle>
  );
}

function ResponsiveDialogDescription({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const isMobile = use(ResponsiveDialogMobileContext);
  return isMobile ? (
    <DrawerDescription className={className}>{children}</DrawerDescription>
  ) : (
    <DialogDescription className={className}>{children}</DialogDescription>
  );
}

function ResponsiveDialogCancel({ children }: { children?: ReactNode }) {
  const isMobile = use(ResponsiveDialogMobileContext);
  const label = children ?? m.common_cancel();
  return isMobile ? (
    <DrawerClose render={<Button variant="outline" />}>{label}</DrawerClose>
  ) : (
    <DialogCancel>{label}</DialogCancel>
  );
}

export {
  ResponsiveDialog,
  ResponsiveDialogCancel,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
};
