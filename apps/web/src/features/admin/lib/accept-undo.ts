import { toast } from "sonner";

/** The undo writes as a manual edit, so the source's value stays available to
 *  accept again. */
export function toastFieldAccepted({
  fieldLabel,
  sourceLabel,
  previousValue,
  onUndo,
}: {
  fieldLabel: string;
  sourceLabel: string;
  previousValue: unknown;
  onUndo: (previousValue: unknown) => void;
}): void {
  toast.success(`Used ${fieldLabel} from ${sourceLabel}`, {
    action: { label: "Undo", onClick: () => onUndo(previousValue ?? null) },
  });
}
