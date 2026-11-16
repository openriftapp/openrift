import type { AcceptFieldResult } from "@openrift/shared/contracts/admin/card-mutations";
import { toast } from "sonner";

import { runReportedMutation } from "@/lib/run-reported-mutation";

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
  accept: (input: TInput) => Promise<AcceptFieldResult>;
  input: NoInfer<TInput>;
  fieldLabel: string;
  sourceLabel: string;
  previousValue: unknown;
  onAccepted?: (revert: NoInfer<TInput>) => void;
}): Promise<boolean> {
  let result: AcceptFieldResult | undefined;
  const accepted = await runReportedMutation(async () => {
    result = await accept(input);
  });
  if (accepted && result?.written) {
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
