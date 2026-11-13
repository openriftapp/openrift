import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { m } from "@/paraglide/messages.js";

interface ScanClearDialogProps {
  count: number | null;
  onOpenChange: (open: boolean) => void;
  onClear: () => void;
}

export function ScanClearDialog({ count, onOpenChange, onClear }: ScanClearDialogProps) {
  return (
    <ConfirmActionDialog
      open={count !== null}
      onOpenChange={onOpenChange}
      title={m.scan_clear_title({ count: count ?? 0 })}
      description={m.scan_clear_description()}
      cancelLabel={m.scan_clear_cancel()}
      confirmLabel={m.scan_clear_confirm()}
      onConfirm={() => {
        onClear();
        onOpenChange(false);
      }}
    />
  );
}
