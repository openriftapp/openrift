import { useBlocker } from "@tanstack/react-router";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { m } from "@/paraglide/messages.js";

interface GuardLocation {
  pathname: string;
  search: object;
}

interface UnsavedChangesGuardProps {
  dirty: boolean;
  onLeave?: () => void;
  allowNavigation?: (current: GuardLocation, next: GuardLocation) => boolean;
}

// The blocker sees `dirty` as of the last commit: clear it inside `flushSync`
// before a programmatic navigation that follows a state change.
export function UnsavedChangesGuard({ dirty, onLeave, allowNavigation }: UnsavedChangesGuardProps) {
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => dirty && !allowNavigation?.(current, next),
    enableBeforeUnload: () => dirty,
    withResolver: true,
  });

  return (
    <ConfirmActionDialog
      open={blocker.status === "blocked"}
      onOpenChange={(open) => {
        if (!open) {
          blocker.reset?.();
        }
      }}
      title={m.unsaved_changes_title()}
      description={m.unsaved_changes_description()}
      confirmLabel={m.unsaved_changes_leave()}
      cancelLabel={m.unsaved_changes_stay()}
      onConfirm={() => {
        onLeave?.();
        blocker.proceed?.();
      }}
    />
  );
}
