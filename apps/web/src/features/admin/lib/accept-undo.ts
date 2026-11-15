import { sameFieldValue } from "@openrift/shared/catalog-field-compare";
import { toast } from "sonner";

import { runReportedMutation } from "@/lib/run-reported-mutation";

function isUnchanged(previousValue: unknown, value: unknown, field?: string): boolean {
  const comparable = value === null || typeof value !== "object" || Array.isArray(value);
  return comparable && sameFieldValue(previousValue ?? null, value, field);
}

/** The undo writes the previous value as a manual edit, so the source's value
 *  stays available to accept again. `onAccepted` replaces the Undo toast.
 *  Resolves `true` when the accept succeeded. */
export async function acceptFieldWithUndo<
  TInput extends { field?: string; value: unknown; source?: "provider" | "manual" },
>({
  accept,
  input,
  fieldLabel,
  sourceLabel,
  previousValue,
  onAccepted,
}: {
  accept: (input: TInput) => Promise<unknown>;
  input: NoInfer<TInput>;
  fieldLabel: string;
  sourceLabel: string;
  previousValue: unknown;
  onAccepted?: (revert: NoInfer<TInput>) => void;
}): Promise<boolean> {
  const accepted = await runReportedMutation(() => accept(input));
  if (accepted && !isUnchanged(previousValue, input.value, input.field)) {
    const undo = { ...input, value: previousValue ?? null, source: "manual" as const };
    if (onAccepted !== undefined) {
      onAccepted(undo);
      return accepted;
    }
    toast.success(`Used ${fieldLabel} from ${sourceLabel}`, {
      action: { label: "Undo", onClick: () => void runReportedMutation(() => accept(undo)) },
    });
  }
  return accepted;
}
