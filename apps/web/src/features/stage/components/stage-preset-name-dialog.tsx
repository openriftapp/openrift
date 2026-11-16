import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { m } from "@/paraglide/messages.js";

export const MAX_PRESET_NAME_LENGTH = 60;

interface StagePresetNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  initialName?: string;
  pending: boolean;
  onConfirm: (name: string) => void;
}

export function StagePresetNameDialog({ open, onOpenChange, ...form }: StagePresetNameDialogProps) {
  // The form remounts on each open, so it starts from `initialName`.
  const [session, setSession] = useState({ open, id: 0 });
  if (session.open !== open) {
    setSession({ open, id: open ? session.id + 1 : session.id });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <StagePresetNameForm key={session.id} {...form} />
      </DialogContent>
    </Dialog>
  );
}

function StagePresetNameForm({
  title,
  description,
  confirmLabel,
  initialName = "",
  pending,
  onConfirm,
}: Omit<StagePresetNameDialogProps, "open" | "onOpenChange">) {
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <Field>
        <FieldLabel htmlFor="stage-preset-name">{m.common_name()}</FieldLabel>
        <Input
          id="stage-preset-name"
          value={name}
          maxLength={MAX_PRESET_NAME_LENGTH}
          placeholder={m.stage_preset_name_placeholder()}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>

      <DialogFooter>
        <DialogCancel />
        <Button onClick={() => onConfirm(trimmed)} disabled={trimmed === "" || pending}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}
