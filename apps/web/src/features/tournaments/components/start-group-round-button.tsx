import { PlayIcon } from "lucide-react";
import { useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages.js";

export function StartGroupRoundButton({
  roundNumber,
  scopeLabel,
  disabled,
  pending,
  size = "sm",
  onConfirm,
}: {
  roundNumber: number;
  /** "Group A", "Group D · E", or "all groups". */
  scopeLabel: string;
  disabled: boolean;
  pending: boolean;
  size?: "sm" | "default";
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const label = m.tournaments_start_round_cta({ number: roundNumber });
  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={setOpen}
      onConfirm={() => {
        setOpen(false);
        onConfirm();
      }}
      destructive={false}
      title={m.tournaments_start_round_confirm_title({ number: roundNumber, scope: scopeLabel })}
      description={m.tournaments_start_round_confirm_description()}
      confirmLabel={label}
      trigger={
        <AlertDialogTrigger disabled={disabled || pending} render={<Button size={size} />}>
          <PlayIcon />
          {label}
        </AlertDialogTrigger>
      }
    />
  );
}
