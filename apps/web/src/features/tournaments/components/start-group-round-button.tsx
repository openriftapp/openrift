import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { PlayIcon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DialogForm } from "@/components/ui/dialog-form";
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
  return (
    <AlertDialog>
      <AlertDialogTrigger disabled={disabled || pending} render={<Button size={size} />}>
        <PlayIcon />
        {m.tournaments_start_round_cta({ number: roundNumber })}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <DialogForm onSubmit={onConfirm}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {m.tournaments_start_round_confirm_title({
                number: roundNumber,
                scope: scopeLabel,
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {m.tournaments_start_round_confirm_description()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.common_cancel()}</AlertDialogCancel>
            <AlertDialogPrimitive.Close render={<Button type="submit" />}>
              {m.tournaments_start_round_cta({ number: roundNumber })}
            </AlertDialogPrimitive.Close>
          </AlertDialogFooter>
        </DialogForm>
      </AlertDialogContent>
    </AlertDialog>
  );
}
