import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages.js";

interface ScanClearDialogProps {
  count: number | null;
  onOpenChange: (open: boolean) => void;
  onClear: () => void;
}

export function ScanClearDialog({ count, onOpenChange, onClear }: ScanClearDialogProps) {
  return (
    <AlertDialog open={count !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {count === 1
              ? m.scan_clear_title_one({ count })
              : m.scan_clear_title_plural({ count: count ?? 0 })}
          </AlertDialogTitle>
          <AlertDialogDescription>{m.scan_clear_description()}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{m.scan_clear_cancel()}</AlertDialogCancel>
          <AlertDialogPrimitive.Close render={<Button variant="destructive" />} onClick={onClear}>
            {m.scan_clear_confirm()}
          </AlertDialogPrimitive.Close>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
