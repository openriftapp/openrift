import { ConfirmActionButton } from "@/components/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { pairingLabel } from "@/features/tournaments/lib/tournament-display";
import { m } from "@/paraglide/messages.js";

export function ClearResultButton({
  podNumber,
  disabled,
  onClear,
}: {
  podNumber: number;
  disabled?: boolean;
  onClear: () => Promise<unknown>;
}) {
  return (
    <ConfirmActionButton
      trigger={<Button variant="ghost" className="text-destructive" />}
      disabled={disabled}
      title={m.tournaments_pod_clear_result_title({ table: pairingLabel(podNumber) })}
      description={m.tournaments_pod_clear_result_description()}
      confirmLabel={m.tournaments_pod_clear_result()}
      onConfirm={onClear}
    >
      {m.tournaments_pod_clear_result()}
    </ConfirmActionButton>
  );
}
