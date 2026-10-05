import type { ReactElement, ReactNode } from "react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
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
import { Input } from "@/components/ui/input";
import { m } from "@/paraglide/messages.js";

interface ConfirmContentProps {
  title: ReactNode;
  description: ReactNode;
  confirmLabel: ReactNode;
  pendingLabel?: ReactNode;
  cancelLabel?: ReactNode;
  destructive?: boolean;
  confirmPhrase?: string;
}

interface ConfirmActionDialogProps extends ConfirmContentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
  trigger?: ReactNode;
}

function confirmPhraseMatches(typed: string, phrase: string): boolean {
  return typed.trim().toLowerCase() === phrase.trim().toLowerCase();
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
  trigger,
  ...content
}: ConfirmActionDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending || nextOpen) {
          onOpenChange(nextOpen);
        }
      }}
    >
      {trigger}
      <AlertDialogContent>
        <ConfirmActionBody {...content} onConfirm={onConfirm} isPending={isPending} />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ConfirmActionBody({
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel,
  destructive = true,
  confirmPhrase,
  onConfirm,
  isPending,
}: ConfirmContentProps & { onConfirm: () => void; isPending: boolean }) {
  const [typed, setTyped] = useState("");
  const phraseSatisfied = confirmPhrase === undefined || confirmPhraseMatches(typed, confirmPhrase);

  return (
    <DialogForm
      onSubmit={() => {
        if (phraseSatisfied && !isPending) {
          onConfirm();
        }
      }}
    >
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      {confirmPhrase === undefined ? null : (
        <Input
          autoComplete="off"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={m.common_confirm_phrase_placeholder({ phrase: confirmPhrase })}
          aria-label={m.common_confirm_phrase_placeholder({ phrase: confirmPhrase })}
          disabled={isPending}
        />
      )}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={isPending}>
          {cancelLabel ?? m.common_cancel()}
        </AlertDialogCancel>
        <AlertDialogAction
          type="submit"
          variant={destructive ? "destructive" : "default"}
          disabled={isPending || !phraseSatisfied}
        >
          {isPending && pendingLabel !== undefined ? pendingLabel : confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </DialogForm>
  );
}

interface ConfirmActionButtonProps extends ConfirmContentProps {
  children: ReactNode;
  onConfirm: () => Promise<unknown>;
  disabled?: boolean;
  trigger?: ReactElement;
}

export function ConfirmActionButton({
  children,
  onConfirm,
  disabled,
  trigger,
  ...content
}: ConfirmActionButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const triggerElement = trigger ?? <Button variant="ghost" size="sm" />;

  async function handleConfirm() {
    setPending(true);
    const succeeded = await onConfirm().then(
      () => true,
      () => false,
    );
    setPending(false);
    if (succeeded) {
      setOpen(false);
    }
  }

  return (
    <ConfirmActionDialog
      {...content}
      open={open}
      onOpenChange={setOpen}
      onConfirm={() => void handleConfirm()}
      isPending={pending}
      trigger={
        <AlertDialogTrigger render={triggerElement} disabled={disabled}>
          {children}
        </AlertDialogTrigger>
      }
    />
  );
}
