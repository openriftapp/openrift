import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SharePanelProps } from "@/features/groups/components/share-panel";
import { SHARE_DIALOG_DESCRIPTION, SharePanel } from "@/features/groups/components/share-panel";

interface ShareDialogProps extends SharePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Defaults to the two-zone framing; override on a dialog with no link. */
  description?: ReactNode;
}

/** {@link SharePanel} in a dialog; every share entry point in the app renders through here. */
export function ShareDialog({
  open,
  onOpenChange,
  title,
  description,
  ...panelProps
}: ShareDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? SHARE_DIALOG_DESCRIPTION[panelProps.noun]()}
          </DialogDescription>
        </DialogHeader>
        <SharePanel {...panelProps} />
      </DialogContent>
    </Dialog>
  );
}
