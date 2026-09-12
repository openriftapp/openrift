import type { ReactElement, ReactNode } from "react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ConfirmActionButtonProps {
  children: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<unknown>;
  disabled?: boolean;
  trigger?: ReactElement;
}

export function ConfirmActionButton({
  children,
  title,
  description,
  confirmLabel,
  onConfirm,
  disabled,
  trigger,
}: ConfirmActionButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  // A JSX default in the destructuring pattern makes the React Compiler bail
  // on the whole file (cannot lower an AssignmentPattern there).
  const triggerElement = trigger ?? <Button variant="ghost" size="sm" />;

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
    } catch {
      // Reported by the global mutation error toast.
      setPending(false);
      return;
    }
    setPending(false);
    setOpen(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={triggerElement} disabled={disabled}>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={pending}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** A finish as the review surfaces print it: the bare number, or `T4` for a cut tier. */
export function rankLabel(rank: number | null, rankIsTier: boolean | null): string {
  if (rank === null) {
    return "";
  }
  return rankIsTier === true ? `T${rank}` : String(rank);
}
