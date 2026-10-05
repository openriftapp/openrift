import type { ReactNode } from "react";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";

interface PaletteFrameProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}

export function PaletteFrame({ open, onOpenChange, title, children }: PaletteFrameProps) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent
        showCloseButton={false}
        drawerClassName="gap-0 p-4"
        dialogClassName="max-w-md gap-0 overflow-visible p-0 sm:max-w-md"
      >
        <ResponsiveDialogTitle className="sr-only">{title}</ResponsiveDialogTitle>
        {open && children}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
