import { Button } from "@/components/ui/button";
import { Kbd } from "@/features/catalog-workspace/components/record/kbd";
import { usePassDismiss } from "@/features/catalog-workspace/hooks/use-card-pass";
import { useRegisterRecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import type { PassDismiss } from "@/features/catalog-workspace/lib/card-pass";

export function RecordDismissAll({
  scope,
  record,
  dismiss,
  isAdmin,
}: {
  scope: readonly (readonly unknown[])[];
  record: string;
  dismiss: PassDismiss;
  isAdmin: boolean;
}) {
  const queueWrite = useQueueWorkspaceWrite();
  const run = usePassDismiss({ scope, record, dismiss });
  const canDismiss = isAdmin && dismiss.suggestions > 0;

  useRegisterRecordActions({
    dismissAll: canDismiss && !run.pending ? (signal) => run.run(signal) : undefined,
  });

  if (!canDismiss) {
    return null;
  }
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={run.pending}
      onClick={() => void queueWrite((signal) => run.run(signal))}
    >
      Dismiss all {dismiss.suggestions}
      <Kbd>D</Kbd>
    </Button>
  );
}
